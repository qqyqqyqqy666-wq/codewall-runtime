import Cocoa
import WebKit

enum HostLifecycleSignal: String {
  case pause
  case resume
  case hidden
  case visible
}

final class HostLifecycleBridge {
  private weak var webView: WKWebView?
  private var observers: [NSObjectProtocol] = []

  init(webView: WKWebView) {
    self.webView = webView
  }

  deinit {
    stopObserving()
  }

  func startObserving(window: NSWindow?) {
    stopObserving()

    let notificationCenter = NotificationCenter.default

    observers.append(
      notificationCenter.addObserver(
        forName: NSApplication.didBecomeActiveNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.emit(.resume)
      }
    )

    observers.append(
      notificationCenter.addObserver(
        forName: NSApplication.didResignActiveNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.emit(.pause)
      }
    )

    if let window {
      observers.append(
        notificationCenter.addObserver(
          forName: NSWindow.didMiniaturizeNotification,
          object: window,
          queue: .main
        ) { [weak self] _ in
          self?.emit(.hidden)
        }
      )

      observers.append(
        notificationCenter.addObserver(
          forName: NSWindow.didDeminiaturizeNotification,
          object: window,
          queue: .main
        ) { [weak self] _ in
          self?.emit(.visible)
        }
      )
    }
  }

  func stopObserving() {
    for observer in observers {
      NotificationCenter.default.removeObserver(observer)
    }

    observers.removeAll()
  }

  func emit(_ signal: HostLifecycleSignal) {
    guard let webView else {
      return
    }

    let script = "window.__codewallHostLifecycle && window.__codewallHostLifecycle('\\(signal.rawValue)');"
    webView.evaluateJavaScript(script)
  }
}
