import Cocoa
import CoreGraphics

private final class DesktopHostWindow: NSWindow {
  override var canBecomeKey: Bool { false }
  override var canBecomeMain: Bool { false }
}

final class DesktopWindowController: NSWindowController {
  init(bundle: Bundle, screen: NSScreen) {
    let contentRect = screen.frame
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
    NSLog("[CodewallHost][Diag] DesktopWindowController init screen=\(screen.localizedName) frame=\(NSStringFromRect(contentRect))")
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
    window.setFrame(contentRect, display: true)
    NSLog("[CodewallHost][Diag] updateGeometry screen=\(screen.localizedName) frame=\(NSStringFromRect(contentRect))")
  }
}
