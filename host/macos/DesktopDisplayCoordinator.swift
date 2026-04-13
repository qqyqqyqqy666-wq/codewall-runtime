import Cocoa

final class DesktopDisplayCoordinator {
  private let bundle: Bundle
  private var controllersByScreenId: [ObjectIdentifier: DesktopWindowController] = [:]
  private var screenObserver: NSObjectProtocol?

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
  }

  private func rebuildWindows() {
    let activeScreens = NSScreen.screens
    let activeIds = Set(activeScreens.map { ObjectIdentifier($0) })
    NSLog("[CodewallHost][Diag] rebuildWindows activeScreens=\(activeScreens.count)")

    for screen in activeScreens {
      let screenId = ObjectIdentifier(screen)
      if let controller = controllersByScreenId[screenId] {
        controller.updateGeometry(for: screen)
        NSLog("[CodewallHost][Diag] updated existing window for screen=\(screen.localizedName)")
        continue
      }

      let controller = DesktopWindowController(bundle: bundle, screen: screen)
      controller.showWindow(self)
      controllersByScreenId[screenId] = controller
      NSLog("[CodewallHost][Diag] created window for screen=\(screen.localizedName)")
    }

    for (screenId, controller) in controllersByScreenId where !activeIds.contains(screenId) {
      controller.close()
      controllersByScreenId.removeValue(forKey: screenId)
      NSLog("[CodewallHost][Diag] removed window for detached screen id=\(screenId)")
    }
  }
}
