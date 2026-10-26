import UIKit
import Capacitor

/// The game's web view, with the app's own native plugins registered.
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ICloudSavePlugin())
    }
}
