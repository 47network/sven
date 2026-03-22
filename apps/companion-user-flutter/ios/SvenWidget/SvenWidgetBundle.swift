import SwiftUI
// ios/SvenWidget/SvenWidgetBundle.swift
//
// Widget bundle entry point — registered automatically by WidgetKit.
// Add any additional Widget types here with additional entries inside
// the @WidgetBundleBuilder body.

import WidgetKit

@main
struct SvenWidgetBundle: WidgetBundle {
    var body: some Widget {
        SvenWidget()
    }
}
