//
//  BroadcastPickerView.swift
//  treeHacks26
//
//  UIViewRepresentable wrapper for RPSystemBroadcastPickerView.
//

import SwiftUI
import ReplayKit

struct BroadcastPickerView: UIViewRepresentable {
    func makeUIView(context: Context) -> RPSystemBroadcastPickerView {
        let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 60, height: 60))
        picker.preferredExtension = "berkeley.treeHacks26.BroadcastExtension"
        picker.showsMicrophoneButton = false
        picker.isUserInteractionEnabled = true

        // Important: Force layout
        picker.setNeedsLayout()
        picker.layoutIfNeeded()

        print("🔴 [BroadcastPicker] makeUIView called")
        print("🔴 [BroadcastPicker] preferredExtension: \(picker.preferredExtension ?? "nil")")
        print("🔴 [BroadcastPicker] subviews count: \(picker.subviews.count)")

        for (i, subview) in picker.subviews.enumerated() {
            print("🔴 [BroadcastPicker] subview[\(i)]: \(type(of: subview)), frame: \(subview.frame), isUserInteractionEnabled: \(subview.isUserInteractionEnabled)")
        }

        return picker
    }

    func updateUIView(_ uiView: RPSystemBroadcastPickerView, context: Context) {
        // Update frame if needed
        if uiView.frame.width != 60 || uiView.frame.height != 60 {
            uiView.frame = CGRect(x: 0, y: 0, width: 60, height: 60)
            uiView.setNeedsLayout()
            uiView.layoutIfNeeded()
        }

        print("🔴 [BroadcastPicker] updateUIView - frame: \(uiView.frame), bounds: \(uiView.bounds)")
        print("🔴 [BroadcastPicker] updateUIView - subviews count: \(uiView.subviews.count)")
        for (i, subview) in uiView.subviews.enumerated() {
            print("🔴 [BroadcastPicker] updateUIView subview[\(i)]: \(type(of: subview)), frame: \(subview.frame), hidden: \(subview.isHidden)")
        }
    }
}

/// Programmatically triggers the broadcast picker.
/// Use this as a fallback if the overlay approach doesn't work.
enum BroadcastPickerTrigger {
    static func tap() {
        print("🔴 [BroadcastTrigger] tap() called")
        let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 60, height: 60))
        picker.preferredExtension = "berkeley.treeHacks26.BroadcastExtension"
        picker.showsMicrophoneButton = false

        // Force layout to ensure subviews are created
        picker.setNeedsLayout()
        picker.layoutIfNeeded()

        print("🔴 [BroadcastTrigger] picker subviews: \(picker.subviews.count)")
        for (i, subview) in picker.subviews.enumerated() {
            print("🔴 [BroadcastTrigger] subview[\(i)]: \(type(of: subview)), frame: \(subview.frame)")
            if let button = subview as? UIButton {
                print("🔴 [BroadcastTrigger] Found UIButton! Sending touchUpInside")
                button.sendActions(for: .touchUpInside)
                return
            }
        }
        print("🔴 [BroadcastTrigger] No UIButton found in picker subviews!")
    }
}
