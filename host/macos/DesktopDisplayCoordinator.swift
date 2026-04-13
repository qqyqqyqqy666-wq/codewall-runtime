import Cocoa
import CoreGraphics

final class DesktopDisplayCoordinator {
  private let bundle: Bundle
  private var controllersByScreenId: [ObjectIdentifier: DesktopWindowController] = [:]
  private var fallbackController: DesktopWindowController?
  private var screenObserver: NSObjectProtocol?
  private var startupRetryScheduled = false

  init(bundle: Bundle) {
    self.bundle = bundle
  }

  deinit {
    if let screenObserver {
      NotificationCenter.default.removeObserver(screenObserver)
    }
  }

  func start() {
    NSLog("[CodewallHost][Diag] DesktopDisplayCoordinator.start")
    rebuildWindows()

    screenObserver = NotificationCenter.default.addObserver(
      forName: NSApplication.didChangeScreenParametersNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.rebuildWindows()
    }

    scheduleStartupRetryIfNeeded()
  }

  private func rebuildWindows() {
    let activeScreens = NSScreen.screens
    NSLog(
      "[CodewallHost][Diag] rebuildWindows: screens=%ld controllers=%ld fallback=%@ appWindows=%ld",
      activeScreens.count,
      controllersByScreenId.count,
      fallbackController == nil ? "no" : "yes",
      NSApp.windows.count
    )
    if activeScreens.isEmpty {
      ensureFallbackWindow()
      return
    }

    if let fallbackController {
      fallbackController.close()
      self.fallbackController = nil
    }

    let activeIds = Set(activeScreens.map { ObjectIdentifier($0) })

    for screen in activeScreens {
      let screenId = ObjectIdentifier(screen)
      if let controller = controllersByScreenId[screenId] {
        NSLog("[CodewallHost][Diag] update existing controller for screen=%@", String(describing: screen))
        controller.updateGeometry(for: screen)
        continue
      }

      NSLog("[CodewallHost][Diag] create controller for screen frame=%@", NSStringFromRect(screen.frame))
      let controller = DesktopWindowController(bundle: bundle, screen: screen)
      controller.showWindow(self)
      controllersByScreenId[screenId] = controller
      NSLog("[CodewallHost][Diag] controller created: appWindows=%ld", NSApp.windows.count)
    }

    for (screenId, controller) in controllersByScreenId where !activeIds.contains(screenId) {
      NSLog("[CodewallHost][Diag] closing controller for removed screenId=%@", String(describing: screenId))
      controller.close()
      controllersByScreenId.removeValue(forKey: screenId)
    }
  }

  private func scheduleStartupRetryIfNeeded() {
    guard !startupRetryScheduled else {
      return
    }

    startupRetryScheduled = true
    DispatchQueue.main.async { [weak self] in
      guard let self else {
        return
      }
      self.startupRetryScheduled = false

      if self.controllersByScreenId.isEmpty {
        NSLog("[CodewallHost][Diag] startup retry triggered rebuild")
        self.rebuildWindows()
      }
    }
  }

  private func ensureFallbackWindow() {
    guard fallbackController == nil, controllersByScreenId.isEmpty else {
      return
    }

    let mainDisplayBounds = CGDisplayBounds(CGMainDisplayID())
    let fallbackFrame = NSRect(
      x: mainDisplayBounds.origin.x,
      y: mainDisplayBounds.origin.y,
      width: mainDisplayBounds.width,
      height: mainDisplayBounds.height
    )

    let controller = DesktopWindowController(bundle: bundle, contentRect: fallbackFrame)
    controller.showWindow(self)
    fallbackController = controller
    NSLog("[CodewallHost][Diag] fallback controller created frame=%@ appWindows=%ld",
          NSStringFromRect(fallbackFrame),
          NSApp.windows.count)
  }
}
