import Cocoa
import WebKit

final class WebViewContainer: NSViewController, WKNavigationDelegate {
  private let bundle: Bundle
  private var lifecycleBridge: HostLifecycleBridge?
  private lazy var webView: WKWebView = {
    let configuration = WKWebViewConfiguration()
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = false

    let view = WKWebView(frame: .zero, configuration: configuration)
    view.autoresizingMask = [.width, .height]
    view.navigationDelegate = self
    return view
  }()

  init(bundle: Bundle) {
    self.bundle = bundle
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func loadView() {
    view = NSView(frame: .zero)
  }

  override func viewDidLoad() {
    super.viewDidLoad()

    webView.frame = view.bounds
    view.addSubview(webView)
    lifecycleBridge = HostLifecycleBridge(webView: webView)
    lifecycleBridge?.startObserving(window: view.window)
    NSLog("[CodewallHost][Diag] WebViewContainer viewDidLoad")

    loadLocalRuntime()
  }

  override func viewDidAppear() {
    super.viewDidAppear()
    lifecycleBridge?.startObserving(window: view.window)
    NSLog("[CodewallHost][Diag] WebViewContainer viewDidAppear")
  }

  override func viewWillDisappear() {
    super.viewWillDisappear()
    lifecycleBridge?.stopObserving()
    NSLog("[CodewallHost][Diag] WebViewContainer viewWillDisappear")
  }

  private func loadLocalRuntime() {
    guard
      let runtimeURL = bundle.url(forResource: "index", withExtension: "html", subdirectory: "dist")
    else {
      NSLog("[CodewallHost] Missing bundled runtime at dist/index.html")
      return
    }

    webView.loadFileURL(runtimeURL, allowingReadAccessTo: runtimeURL.deletingLastPathComponent())
    NSLog("[CodewallHost][Diag] loading runtime url=\(runtimeURL.path)")
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    lifecycleBridge?.emit(.visible)
    lifecycleBridge?.emit(.resume)
    NSLog("[CodewallHost][Diag] webView didFinish navigation")
  }
}
