# Android Network/DNS Diagnostic

Timestamp: 2026-02-22T20:08:51.9148558+02:00
Device: R58N94KML7J

## adb shell `cmd wifi status`
```
Wifi is enabled
Wifi scanning is only available when wifi is enabled
==== Primary ClientModeManager instance ====
Wifi is connected to "XLVII"
WifiInfo: SSID: "XLVII", BSSID: 90:09:d0:29:c1:69, MAC: 2e:63:0e:c3:65:4f, IP: /192.168.10.121, Security type: 2, Supplicant state: COMPLETED, Wi-Fi standard: 5, RSSI: -38, Link speed: 433Mbps, Tx Link speed: 433Mbps, Max Supported Tx Link speed: 433Mbps, Rx Link speed: 6Mbps, Max Supported Rx Link speed: 433Mbps, Frequency: 5520MHz, Net ID: 7, Metered hint: false, score: 60, isUsable: true, CarrierMerged: false, SubscriptionId: -1, IsPrimary: 1, Trusted: true, Restricted: false, Ephemeral: false, OEM paid: false, OEM private: false, OSU AP: false, FQDN: <none>, Provider friendly name: <none>, Requesting package name: <none>"XLVII"wpa2-pskMLO Information: , AP MLD Address: <none>, AP MLO Link Id: <none>, AP MLO Affiliated links: <none>
successfulTxPackets: 390
successfulTxPacketsPerSecond: 0.0408785514185343
retriedTxPackets: 396
retriedTxPacketsPerSecond: 0.010256725672670363
lostTxPackets: 11
lostTxPacketsPerSecond: 3.838292934587522E-22
successfulRxPackets: 19644
successfulRxPacketsPerSecond: 63.045299598076056
exit_code=0
```

## adb shell `dumpsys connectivity | head -n 80`
```
NetworkProviders for:
  4: PhoneSwitcherNetworkRequstListener
  2: VcnNetworkProvider
  3: VpnNetworkProvider:0
  9: RestrictedWifiNetworkFactory
  1: EthernetNetworkFactory
  8: UntrustedWifiNetworkFactory
  10: OemPaidWifiNetworkFactory
  5: TelephonyNetworkFactory[0]
  6: TelephonyNetworkFactory[1]
  7: WifiNetworkFactory
  11: MultiInternetWifiNetworkFactory

Active default network: 106

Current network preferences: 
  Default requests:

Current Networks:
  NetworkAgentInfo{network{106}  handle{458672230413}  ni{WIFI CONNECTED extra: } Score(60 ; KeepConnected : 0 ; Policies : TRANSPORT_PRIMARY&EVER_VALIDATED_NOT_AVOIDED_WHEN_BAD&IS_UNMETERED&IS_VALIDATED)  created everValidated lastValidated  lp{{InterfaceName: wlan0 LinkAddresses: [ fe80::2c63:eff:fec3:654f/64,192.168.10.121/24 ] DnsAddresses: [ /192.168.10.1 ] Domains: ursu.cloud MTU: 0 ServerAddress: /192.168.10.1 TcpBufferSizes: 524288,1048576,2097152,262144,524288,1048576 Routes: [ fe80::/64 -> :: wlan0 mtu 0,192.168.10.0/24 -> 0.0.0.0 wlan0 mtu 0,0.0.0.0/0 -> 192.168.10.1 wlan0 mtu 0 ]}}  nc{[ Transports: WIFI Capabilities: NOT_METERED&INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&VALIDATED&NOT_ROAMING&FOREGROUND&NOT_CONGESTED&NOT_SUSPENDED&NOT_VCN_MANAGED LinkUpBandwidth>=12000Kbps LinkDnBandwidth>=60000Kbps Specifier: <WifiNetworkAgentSpecifier [WifiConfiguration=, SSID="XLVII", BSSID=90:09:d0:29:c1:69, band=2, mMatchLocalOnlySpecifiers=false]> TransportInfo: <SSID: "XLVII", BSSID: 90:09:d0:29:c1:69, MAC: 2e:63:0e:c3:65:4f, IP: /192.168.10.121, Security type: 2, Supplicant state: COMPLETED, Wi-Fi standard: 5, RSSI: -36, Link speed: 433Mbps, Tx Link speed: 433Mbps, Max Supported Tx Link speed: 433Mbps, Rx Link speed: 6Mbps, Max Supported Rx Link speed: 433Mbps, Frequency: 5520MHz, Net ID: 7, Metered hint: false, score: 60, isUsable: true, CarrierMerged: false, SubscriptionId: -1, IsPrimary: 1, Trusted: true, Restricted: false, Ephemeral: false, OEM paid: false, OEM private: false, OSU AP: false, FQDN: <none>, Provider friendly name: <none>, Requesting package name: <none>"XLVII"wpa2-pskMLO Information: , AP MLD Address: <none>, AP MLO Link Id: <none>, AP MLO Affiliated links: <none>> SignalStrength: -36 OwnerUid: 1000 AdminUids: [1000] SSID: "XLVII" UnderlyingNetworks: Null]}  factorySerialNumber=7}
    Requests: REQUEST:51 LISTEN:30 BACKGROUND_REQUEST:0 total:81
      NetworkRequest [ REQUEST id=1, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=5, [ Capabilities: FOREGROUND RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=7, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1000 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=8, [ Capabilities: FOREGROUND RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=9, [ Capabilities: NOT_RESTRICTED&TRUSTED&NOT_VPN&FOREGROUND&NOT_VCN_MANAGED Uid: 1000 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=10, [ Transports: CELLULAR|WIFI Capabilities: NOT_VPN&FOREGROUND RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=12, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=14, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=15, [ Capabilities: FOREGROUND RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=16, [ RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=17, [ Capabilities: NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 1000 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=20, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1010130 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=22, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1010116 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=23, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&VALIDATED&NOT_VCN_MANAGED Uid: 1000 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=25, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1010114 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=27, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10194 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=29, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10192 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=31, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10182 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=33, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10179 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=35, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10130 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=37, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10116 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=39, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10114 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=41, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1010115 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=43, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10115 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=45, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1010194 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=47, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1000 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=48, [ Transports: CELLULAR|WIFI Capabilities: NOT_VPN RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=50, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1073 RequestorUid: 1073 RequestorPkg: com.android.networkstack UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=51, [ Transports: WIFI Capabilities: NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 1073 RequestorUid: 1073 RequestorPkg: com.android.networkstack UnderlyingNetworks: Null] ]
      NetworkRequest [ TRACK_SYSTEM_DEFAULT id=52, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED RequestorUid: 1073 RequestorPkg: com.android.networkstack.tethering UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=53, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=55, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=56, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=58, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=59, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=61, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=62, [ Transports: WIFI Capabilities: INTERNET&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 1001 RequestorUid: 1001 RequestorPkg: com.android.phone UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=64, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1001 RequestorUid: 1001 RequestorPkg: com.android.phone UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=65, [ Transports: WIFI Capabilities: INTERNET&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 1001 RequestorUid: 1001 RequestorPkg: com.android.phone UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=67, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1001 RequestorUid: 1001 RequestorPkg: com.android.phone UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=70, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=72, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=73, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=75, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=76, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=78, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=79, [ Capabilities: NOT_RESTRICTED&TRUSTED&NOT_VPN&VALIDATED&NOT_VCN_MANAGED Uid: 1001 RequestorUid: 1001 RequestorPkg: com.android.ons UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=84, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1000 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=88, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10170 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=89, [ Transports: CELLULAR|WIFI Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&FOREGROUND&NOT_VCN_MANAGED Uid: 10170 RequestorUid: 10170 RequestorPkg: com.x8bit.bitwarden UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=118, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10110 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=123, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10112 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=135, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10072 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=165, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10277 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=184, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10195 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ LISTEN id=592, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&FOREGROUND&NOT_VCN_MANAGED Uid: 10201 RequestorUid: 10201 RequestorPkg: com.microsoft.appmanager UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=594, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10201 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=598, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10201 RequestorUid: 10201 RequestorPkg: com.microsoft.appmanager UnderlyingNetworks: Null] ]
      NetworkRequest [ REQUEST id=609, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10138 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]
exit_code=0
```

## adb shell `getprop net.dns1`
```

exit_code=0
```

## adb shell `getprop net.dns2`
```

exit_code=0
```

## adb shell `ip route`
```
192.168.10.0/24 dev wlan0 proto kernel scope link src 192.168.10.121
exit_code=0
```

## adb shell `curl -I -m 12 https://example.com`
```
adb.exe :   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
At X:\47network\apps\openclaw-sven\sven_v0.1.0\scripts\ops\mobile\capture-android-network-dns-diagnostic.ps1:48 char:15
+     $output = & $AdbPath @args 2>&1
+               ~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ...  Time  Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload   Total   Spent    Left  Speed

  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0
  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0
HTTP/1.1 200 OK

Date: Sun, 22 Feb 2026 18:08:55 GMT

Content-Type: text/html

Connection: keep-alive

CF-RAY: 9d206e7b8a9ee4b7-OTP

last-modified: Wed, 18 Feb 2026 05:34:44 GMT

allow: GET, HEAD

Accept-Ranges: bytes

Age: 11639

cf-cache-status: HIT

Server: cloudflare
exit_code=0
```


