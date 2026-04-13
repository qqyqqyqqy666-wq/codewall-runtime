import Cocoa

final class DesktopDisplayCoordinator {
  private let bundle: Bundle
  private var controllersByScreenId: [ObjectIdentifier: DesktopWindowController] = [:]
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
    let activeIds = Set(activeScreens.map { ObjectIdentifier($0) })

    for screen in activeScreens {
      let screenId = ObjectIdentifier(screen)
      if let controller = controllersByScreenId[screenId] {
        controller.updateGeometry(for: screen)
        continue
      }

      let controller = DesktopWindowController(bundle: bundle, screen: screen)
      controller.showWindow(self)
      controllersByScreenId[screenId] = controller
    }

    for (screenId, controller) in controllersByScreenId where !activeIds.contains(screenId) {
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
        self.rebuildWindows()
      }
    }
  }
}
