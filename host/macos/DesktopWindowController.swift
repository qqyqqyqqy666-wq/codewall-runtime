import Cocoa
import CoreGraphics

private final class DesktopHostWindow: NSWindow {
  override var canBecomeKey: Bool { false }
  override var canBecomeMain: Bool { false }
}

final class DesktopWindowController: NSWindowController {
  init(bundle: Bundle, screen: NSScreen) {
    self.init(bundle: bundle, contentRect: screen.frame)
  }

  init(bundle: Bundle, contentRect: NSRect) {
    NSLog("[CodewallHost][Diag] DesktopWindowController.init frame=%@", NSStringFromRect(contentRect))
    let window = DesktopHostWindow(
      contentRect: contentRect,
      styleMask: [.borderless],
      backing: .buffered,
      defer: false
    )

    window.title = "Codewall Host"
    window.isOpaque = true
    window.backgroundColor = .black
    window.hasShadow = false
    window.isMovable = false
    window.ignoresMouseEvents = true
    window.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)))
    window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
    window.setFrame(contentRect, display: true)

    let webViewController = WebViewContainer(bundle: bundle)
    window.contentViewController = webViewController

    super.init(window: window)
    shouldCascadeWindows = false

    window.orderFrontRegardless()
    NSLog("[CodewallHost][Diag] window ordered: visible=%@ appWindows=%ld",
          window.isVisible ? "yes" : "no",
          NSApp.windows.count)

    DispatchQueue.main.async { [weak window] in
      guard let window else {
        NSLog("[CodewallHost][Diag] async visibility check: window released")
        return
      }
      NSLog("[CodewallHost][Diag] async visibility check: visible=%@ occlusion=%ld",
            window.isVisible ? "yes" : "no",
            window.occlusionState.rawValue)
    }
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func updateGeometry(for screen: NSScreen) {
    guard let window else {
      return
    }

    let contentRect = screen.frame
    NSLog("[CodewallHost][Diag] updateGeometry frame=%@", NSStringFromRect(contentRect))
    window.setFrame(contentRect, display: true)
  }
}
