import Foundation
import Capacitor

/// Keeps the game's save in the player's iCloud key-value store, so it follows
/// them to their other iPhones and iPads. Used from src/lib/icloud.ts.
@objc(ICloudSavePlugin)
public class ICloudSavePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ICloudSavePlugin"
    public let jsName = "ICloudSave"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise)
    ]

    private let store = NSUbiquitousKeyValueStore.default

    override public func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(storeChanged(_:)),
            name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: store
        )
        store.synchronize()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("Missing key")
            return
        }
        call.resolve(["value": store.string(forKey: key) ?? NSNull()])
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value") else {
            call.reject("Missing key or value")
            return
        }
        store.set(value, forKey: key)
        store.synchronize()
        call.resolve()
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("Missing key")
            return
        }
        store.removeObject(forKey: key)
        store.synchronize()
        call.resolve()
    }

    /// Another device changed the save: hand the new value to the game.
    @objc private func storeChanged(_ notification: Notification) {
        let keys = notification.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] ?? []
        for key in keys {
            notifyListeners("change", data: ["key": key, "value": store.string(forKey: key) ?? NSNull()])
        }
    }
}
