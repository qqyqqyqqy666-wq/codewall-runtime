import Cocoa

final class HostMenuController: NSObject {
  private let startupLoginController: StartupLoginController
  private var statusItem: NSStatusItem?
  private var statusMenu: NSMenu?
  private var applicationMenu: NSMenu?
  private var launchAtLoginMenuItems: [NSMenuItem] = []

  init(startupLoginController: StartupLoginController) {
    self.startupLoginController = startupLoginController
  }

  func installMenu() {
    launchAtLoginMenuItems.removeAll()

    let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    statusItem.button?.title = "Codewall"

    let statusMenu = makeHostMenu(quitKeyEquivalent: "q")
    statusItem.menu = statusMenu

    self.statusItem = statusItem
    self.statusMenu = statusMenu
    installApplicationMenu()
  }

  @objc
  private func toggleLaunchAtLogin() {
    let currentlyEnabled = launchAtLoginMenuItems.first?.state == .on
    let nextValue = !currentlyEnabled
    let updated = startupLoginController.setLaunchAtLogin(enabled: nextValue)

    if updated {
      let state: NSControl.StateValue = nextValue ? .on : .off
      for menuItem in launchAtLoginMenuItems {
        menuItem.state = state
      }
    }
  }

  @objc
  private func quitApp() {
    NSApplication.shared.terminate(nil)
  }

  private func makeHostMenu(quitKeyEquivalent: String) -> NSMenu {
    let menu = NSMenu()

    let launchAtLoginItem = NSMenuItem(
      title: "Launch at Login",
      action: #selector(toggleLaunchAtLogin),
      keyEquivalent: ""
    )
    launchAtLoginItem.target = self
    launchAtLoginItem.state = startupLoginController.launchAtLoginEnabled ? .on : .off
    launchAtLoginMenuItems.append(launchAtLoginItem)
    menu.addItem(launchAtLoginItem)

    menu.addItem(.separator())

    let quitItem = NSMenuItem(title: "Quit Codewall", action: #selector(quitApp), keyEquivalent: quitKeyEquivalent)
    quitItem.target = self
    menu.addItem(quitItem)

    return menu
  }

  private func installApplicationMenu() {
    let appName = Bundle.main.object(forInfoDictionaryKey: kCFBundleNameKey as String) as? String ?? "CodewallHost"
    let mainMenu = NSMenu(title: appName)
    let appMenuItem = NSMenuItem(title: appName, action: nil, keyEquivalent: "")
    mainMenu.addItem(appMenuItem)

    let appMenu = makeHostMenu(quitKeyEquivalent: "q")
    appMenuItem.submenu = appMenu

    NSApplication.shared.mainMenu = mainMenu
    applicationMenu = appMenu
  }
}
