//
//  ScreenRecorderViewModel.swift
//  treeHacks26
//
//  Created by Shivam Kumar on 2/14/26.
//

import SwiftUI
import AVFoundation
import Photos
import PhotosUI

@Observable
class ScreenRecorderViewModel {
    var isRecording = false
    var statusMessage = "Ready to record"
    var isSaving = false
    var debugLog = ""
    var selectedVideoItem: PhotosPickerItem? {
        didSet { handlePickedVideo() }
    }

    init() {
        registerForBroadcastFinished()
        SharedConstants.log("[App] ViewModel init, sharedContainerURL: \(SharedConstants.sharedContainerURL?.path ?? "NIL")")
    }

    deinit {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        CFNotificationCenterRemoveObserver(center, Unmanaged.passUnretained(self).toOpaque(), nil, nil)
    }

    // MARK: - Debug

    func refreshDebugLog() {
        guard let logURL = SharedConstants.debugLogURL,
              let contents = try? String(contentsOf: logURL, encoding: .utf8) else {
            debugLog = "No debug log found at: \(SharedConstants.debugLogURL?.path ?? "nil")"
            return
        }
        debugLog = contents
    }

    func clearDebugLog() {
        guard let logURL = SharedConstants.debugLogURL else { return }
        try? FileManager.default.removeItem(at: logURL)
        debugLog = ""
    }

    // MARK: - Darwin Notification

    private func registerForBroadcastFinished() {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let observer = Unmanaged.passUnretained(self).toOpaque()

        CFNotificationCenterAddObserver(
            center,
            observer,
            { _, observer, _, _, _ in
                guard let observer = observer else { return }
                let vm = Unmanaged<ScreenRecorderViewModel>.fromOpaque(observer).takeUnretainedValue()
                DispatchQueue.main.async {
                    SharedConstants.log("[App] Darwin notification received!")
                    vm.handleBroadcastFinished()
                }
            },
            SharedConstants.broadcastFinishedNotification as CFString,
            nil,
            .deliverImmediately
        )
        SharedConstants.log("[App] Registered Darwin notification listener")
    }

    // MARK: - Broadcast Finished Handling

    func handleBroadcastFinished() {
        SharedConstants.log("[App] handleBroadcastFinished called")

        guard let sharedURL = SharedConstants.broadcastVideoURL else {
            SharedConstants.log("[App] ERROR: broadcastVideoURL is nil")
            statusMessage = "Error: App Group not configured"
            isRecording = false
            return
        }

        SharedConstants.log("[App] Checking for file at: \(sharedURL.path)")
        let exists = FileManager.default.fileExists(atPath: sharedURL.path)
        SharedConstants.log("[App] File exists: \(exists)")

        guard exists else {
            statusMessage = "No recording found"
            isRecording = false

            // List shared container contents for debugging
            if let containerURL = SharedConstants.sharedContainerURL,
               let contents = try? FileManager.default.contentsOfDirectory(atPath: containerURL.path) {
                SharedConstants.log("[App] Shared container contents: \(contents)")
            }
            return
        }

        let size = (try? FileManager.default.attributesOfItem(atPath: sharedURL.path)[.size] as? Int64) ?? 0
        SharedConstants.log("[App] Video file size: \(size) bytes")

        isRecording = false
        statusMessage = "Trimming video..."
        isSaving = true

        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("mov")

        do {
            try FileManager.default.copyItem(at: sharedURL, to: tempURL)
            try FileManager.default.removeItem(at: sharedURL)
            SharedConstants.log("[App] Copied to temp: \(tempURL.path)")
        } catch {
            SharedConstants.log("[App] ERROR copying: \(error)")
            statusMessage = "Failed to copy recording: \(error.localizedDescription)"
            isSaving = false
            return
        }

        processVideo(sourceURL: tempURL, trimFirst5Seconds: true)
    }

    /// Called when the app returns to foreground — checks for a pending recording file.
    func checkForPendingRecording() {
        SharedConstants.log("[App] checkForPendingRecording called")
        guard let sharedURL = SharedConstants.broadcastVideoURL else { return }
        if FileManager.default.fileExists(atPath: sharedURL.path), !isSaving {
            SharedConstants.log("[App] Found pending recording!")
            handleBroadcastFinished()
        } else {
            SharedConstants.log("[App] No pending recording. isSaving=\(isSaving)")
        }
    }

    // MARK: - Video Upload from Library

    private func handlePickedVideo() {
        guard let item = selectedVideoItem else { return }
        statusMessage = "Loading video..."
        isSaving = true

        Task {
            do {
                guard let movie = try await item.loadTransferable(type: VideoTransferable.self) else {
                    await MainActor.run {
                        self.statusMessage = "Failed to load video"
                        self.isSaving = false
                    }
                    return
                }
                await MainActor.run {
                    self.statusMessage = "Processing video..."
                }
                processVideo(sourceURL: movie.url, trimFirst5Seconds: false)
            } catch {
                await MainActor.run {
                    self.statusMessage = "Error loading video: \(error.localizedDescription)"
                    self.isSaving = false
                }
            }
        }
    }

    // MARK: - Video Upload

    private func uploadVideo(fileURL: URL) async -> Result<[String: Any], Error> {
        let endpoint = "https://vihaan.ayush.digital/generate-worldvr"

        guard let url = URL(string: endpoint) else {
            return .failure(NSError(domain: "UploadError", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid endpoint URL"]))
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        do {
            let videoData = try Data(contentsOf: fileURL)
            SharedConstants.log("[App] Video file size for upload: \(videoData.count) bytes")

            var body = Data()

            // Add video file part
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"video\"; filename=\"recording.mov\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: video/quicktime\r\n\r\n".data(using: .utf8)!)
            body.append(videoData)
            body.append("\r\n".data(using: .utf8)!)
            body.append("--\(boundary)--\r\n".data(using: .utf8)!)

            request.httpBody = body
            request.timeoutInterval = 300 // 5 minutes for large video uploads

            SharedConstants.log("[App] Sending POST request to \(endpoint)")

            // Use custom session configuration for large uploads
            let configuration = URLSessionConfiguration.default
            configuration.timeoutIntervalForRequest = 300
            configuration.timeoutIntervalForResource = 600
            let session = URLSession(configuration: configuration)

            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                return .failure(NSError(domain: "UploadError", code: -2, userInfo: [NSLocalizedDescriptionKey: "Invalid response"]))
            }

            SharedConstants.log("[App] Upload response status: \(httpResponse.statusCode)")

            guard httpResponse.statusCode == 200 else {
                let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
                SharedConstants.log("[App] Upload failed with status \(httpResponse.statusCode): \(errorMessage)")
                return .failure(NSError(domain: "UploadError", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Server returned status \(httpResponse.statusCode)"]))
            }

            // Parse JSON response
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                SharedConstants.log("[App] Upload response JSON: \(json)")
                return .success(json)
            } else {
                let responseString = String(data: data, encoding: .utf8) ?? "Unable to decode response"
                SharedConstants.log("[App] Upload response (non-JSON): \(responseString)")
                return .success(["raw": responseString])
            }

        } catch {
            SharedConstants.log("[App] Upload error: \(error.localizedDescription)")
            return .failure(error)
        }
    }

    // MARK: - Shared Processing

    private func processVideo(sourceURL: URL, trimFirst5Seconds: Bool) {
        let asset = AVURLAsset(url: sourceURL)

        Task {
            do {
                SharedConstants.log("[App] processVideo started, trimFirst5Seconds=\(trimFirst5Seconds)")

                let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
                SharedConstants.log("[App] Photo library auth status: \(status.rawValue)")
                guard status == .authorized || status == .limited else {
                    await MainActor.run {
                        self.statusMessage = "Photo library access denied. Enable in Settings."
                        self.isSaving = false
                    }
                    try? FileManager.default.removeItem(at: sourceURL)
                    return
                }

                let duration = try await asset.load(.duration)
                SharedConstants.log("[App] Video duration: \(CMTimeGetSeconds(duration))s")

                let timeRange: CMTimeRange
                if trimFirst5Seconds {
                    let trimStart = CMTime(seconds: 5, preferredTimescale: 600)
                    guard CMTimeCompare(duration, trimStart) == 1 else {
                        SharedConstants.log("[App] Video too short to trim")
                        await MainActor.run {
                            self.statusMessage = "Video too short to trim 5 seconds"
                            self.isSaving = false
                        }
                        try? FileManager.default.removeItem(at: sourceURL)
                        return
                    }
                    timeRange = CMTimeRange(start: trimStart, end: duration)
                } else {
                    timeRange = CMTimeRange(start: .zero, end: duration)
                }

                guard let exportSession = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality) else {
                    SharedConstants.log("[App] ERROR: Failed to create export session")
                    await MainActor.run {
                        self.statusMessage = "Failed to create export session"
                        self.isSaving = false
                    }
                    return
                }

                let outputURL = FileManager.default.temporaryDirectory
                    .appendingPathComponent(UUID().uuidString)
                    .appendingPathExtension("mov")

                exportSession.outputURL = outputURL
                exportSession.outputFileType = .mov
                exportSession.timeRange = timeRange

                SharedConstants.log("[App] Starting export...")
                await exportSession.export()
                SharedConstants.log("[App] Export status: \(exportSession.status.rawValue), error: \(exportSession.error?.localizedDescription ?? "none")")

                guard exportSession.status == .completed else {
                    await MainActor.run {
                        self.statusMessage = "Export failed: \(exportSession.error?.localizedDescription ?? "unknown")"
                        self.isSaving = false
                    }
                    return
                }

                try? FileManager.default.removeItem(at: sourceURL)

                // Upload to API endpoint
                await MainActor.run {
                    self.statusMessage = "Uploading video..."
                }

                SharedConstants.log("[App] Uploading to API...")
                let uploadResult = await uploadVideo(fileURL: outputURL)

                switch uploadResult {
                case .success(let response):
                    SharedConstants.log("[App] Upload successful: \(response)")
                    await MainActor.run {
                        self.statusMessage = "Upload successful! Saving to Photos..."
                    }
                case .failure(let error):
                    SharedConstants.log("[App] Upload failed: \(error.localizedDescription)")
                    await MainActor.run {
                        self.statusMessage = "Upload failed: \(error.localizedDescription). Saving to Photos anyway..."
                    }
                }

                SharedConstants.log("[App] Saving to Photos...")
                try await PHPhotoLibrary.shared().performChanges {
                    PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: outputURL)
                }

                try? FileManager.default.removeItem(at: outputURL)

                SharedConstants.log("[App] Saved to Photos successfully!")
                await MainActor.run {
                    let suffix = trimFirst5Seconds ? " (first 5s trimmed)" : ""
                    if case .success = uploadResult {
                        self.statusMessage = "✅ Uploaded & saved to Photos\(suffix)"
                    } else {
                        self.statusMessage = "⚠️ Saved to Photos\(suffix) (upload failed)"
                    }
                    self.isSaving = false
                }
            } catch {
                SharedConstants.log("[App] ERROR in processVideo: \(error)")
                await MainActor.run {
                    self.statusMessage = "Error: \(error.localizedDescription)"
                    self.isSaving = false
                }
            }
        }
    }
}

// MARK: - Transferable for video picker

struct VideoTransferable: Transferable {
    let url: URL

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .movie) { video in
            SentTransferredFile(video.url)
        } importing: { received in
            let tempURL = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension(received.file.pathExtension)
            try FileManager.default.copyItem(at: received.file, to: tempURL)
            return Self(url: tempURL)
        }
    }
}
