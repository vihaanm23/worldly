//
//  ContentView.swift
//  treeHacks26
//
//  Created by Shivam Kumar on 2/14/26.
//

import SwiftUI
import PhotosUI

struct ContentView: View {
    @State private var viewModel = ScreenRecorderViewModel()
    @Environment(\.scenePhase) private var scenePhase
    @State private var showDebugLog = false

    var body: some View {
        ZStack {
            // Clean white background
            Color.white.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    // Header Section
                    VStack(spacing: 16) {
                        // Status Icon
                        ZStack {
                            Circle()
                                .fill(Color.black.opacity(0.04))
                                .frame(width: 120, height: 120)

                            Image(systemName: viewModel.isRecording ? "record.circle.fill" : "video.circle.fill")
                                .font(.system(size: 52, weight: .light))
                                .foregroundStyle(viewModel.isRecording ? .red : .black)
                                .symbolEffect(.pulse, isActive: viewModel.isRecording)
                        }
                        .padding(.top, 60)
                        .padding(.bottom, 8)

                        // Status Text
                        Text(viewModel.statusMessage)
                            .font(.system(size: 16, weight: .regular))
                            .foregroundStyle(.black.opacity(0.7))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 40)
                            .frame(minHeight: 44)

                        // Progress Indicator
                        if viewModel.isSaving {
                            ProgressView()
                                .tint(.black)
                                .padding(.top, 8)
                        }
                    }
                    .padding(.bottom, 48)

                    // Action Cards
                    VStack(spacing: 16) {
                        // Record Button
                        ActionCard(
                            icon: "record.circle",
                            title: "Screen Recording",
                            subtitle: "Record your screen",
                            isDisabled: viewModel.isSaving
                        ) {
                            BroadcastPickerTrigger.tap()
                        }

                        // Upload Button
                        PhotosPicker(
                            selection: $viewModel.selectedVideoItem,
                            matching: .videos
                        ) {
                            ActionCardLabel(
                                icon: "arrow.up.circle",
                                title: "Upload Video",
                                subtitle: "From your library",
                                isDisabled: viewModel.isSaving
                            )
                        }
                        .disabled(viewModel.isSaving)
                    }
                    .padding(.horizontal, 24)

                    Spacer(minLength: 80)
                }
            }

            // Debug Toggle (bottom corner)
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                            viewModel.refreshDebugLog()
                            showDebugLog.toggle()
                        }
                    } label: {
                        Image(systemName: showDebugLog ? "xmark.circle.fill" : "info.circle")
                            .font(.system(size: 22, weight: .medium))
                            .foregroundStyle(.black.opacity(0.3))
                            .frame(width: 44, height: 44)
                    }
                    .padding(.trailing, 24)
                    .padding(.bottom, 24)
                }
            }
        }
        .sheet(isPresented: $showDebugLog) {
            DebugLogView(viewModel: viewModel)
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                viewModel.checkForPendingRecording()
                if showDebugLog { viewModel.refreshDebugLog() }
            }
        }
    }
}

// MARK: - Action Card Component

struct ActionCard: View {
    let icon: String
    let title: String
    let subtitle: String
    let isDisabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ActionCardLabel(icon: icon, title: title, subtitle: subtitle, isDisabled: isDisabled)
        }
        .disabled(isDisabled)
    }
}

struct ActionCardLabel: View {
    let icon: String
    let title: String
    let subtitle: String
    let isDisabled: Bool

    var body: some View {
        HStack(spacing: 16) {
            // Icon
            ZStack {
                Circle()
                    .fill(Color.black.opacity(isDisabled ? 0.02 : 0.05))
                    .frame(width: 56, height: 56)

                Image(systemName: icon)
                    .font(.system(size: 24, weight: .medium))
                    .foregroundStyle(.black.opacity(isDisabled ? 0.3 : 1))
            }

            // Text
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.black.opacity(isDisabled ? 0.3 : 1))

                Text(subtitle)
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(.black.opacity(isDisabled ? 0.2 : 0.5))
            }

            Spacer()

            // Chevron
            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.black.opacity(isDisabled ? 0.1 : 0.2))
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white)
                .shadow(color: .black.opacity(isDisabled ? 0.03 : 0.06), radius: 12, x: 0, y: 4)
        )
        .opacity(isDisabled ? 0.6 : 1)
    }
}

// MARK: - Debug Log Sheet

struct DebugLogView: View {
    @Environment(\.dismiss) var dismiss
    let viewModel: ScreenRecorderViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(viewModel.debugLog.isEmpty ? "No logs yet" : viewModel.debugLog)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.black.opacity(0.8))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(Color.black.opacity(0.03))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding()
            }
            .background(Color.white)
            .navigationTitle("Debug Log")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Clear") {
                        viewModel.clearDebugLog()
                    }
                    .foregroundStyle(.red)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundStyle(.black)
                }
            }
        }
    }
}

#Preview {
    ContentView()
}
