# Android Network/DNS Diagnostic

Timestamp: 2026-02-22T20:01:54.7525180+02:00
Device: R58N94KML7J

## adb shell $cmd
```
Wifi is enabled
Wifi scanning is only available when wifi is enabled
==== Primary ClientModeManager instance ====
Wifi is not connected
exit_code=0
```

## adb shell $cmd
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

Active default network: none

Current network preferences: 
  Default requests:

Current Networks:

Status for known UIDs:
  UID=10186 blockedReasons=8
  UID=1010186 blockedReasons=8
  UID=1010194 blockedReasons=8
  
Network Requests:
  uid/pid:1000/4589 activeRequest: null callbackRequest: 1 [NetworkRequest [ REQUEST id=1, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 1 order: 2147483647
  uid/pid:1000/4589 activeRequest: null callbackRequest: 2 [NetworkRequest [ BACKGROUND_REQUEST id=2, [ Transports: CELLULAR Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 1 order: 2147483647
  uid/pid:1000/4589 activeRequest: null callbackRequest: 5 [NetworkRequest [ LISTEN id=5, [ Capabilities: FOREGROUND RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 activeRequest: null callbackRequest: 6 [NetworkRequest [ REQUEST id=7, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1000 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 activeRequest: null callbackRequest: 8 [NetworkRequest [ LISTEN id=8, [ Capabilities: FOREGROUND RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 activeRequest: null callbackRequest: 9 [NetworkRequest [ LISTEN id=9, [ Capabilities: NOT_RESTRICTED&TRUSTED&NOT_VPN&FOREGROUND&NOT_VCN_MANAGED Uid: 1000 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 10 [NetworkRequest [ LISTEN id=10, [ Transports: CELLULAR|WIFI Capabilities: NOT_VPN&FOREGROUND RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 1 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 11 [NetworkRequest [ REQUEST id=12, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 1 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 13 [NetworkRequest [ REQUEST id=14, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 1 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 15 [NetworkRequest [ LISTEN id=15, [ Capabilities: FOREGROUND RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 activeRequest: null callbackRequest: 16 [NetworkRequest [ LISTEN id=16, [ RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 activeRequest: null callbackRequest: 17 [NetworkRequest [ LISTEN id=17, [ Capabilities: NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 1000 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 activeRequest: null callbackRequest: 18 [NetworkRequest [ LISTEN id=18, [ Transports: CELLULAR Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 1000 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 1010130 activeRequest: null callbackRequest: 19 [NetworkRequest [ REQUEST id=20, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1010130 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 1010116 activeRequest: null callbackRequest: 21 [NetworkRequest [ REQUEST id=22, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1010116 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 activeRequest: null callbackRequest: 23 [NetworkRequest [ LISTEN id=23, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&VALIDATED&NOT_VCN_MANAGED Uid: 1000 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 1010114 activeRequest: null callbackRequest: 24 [NetworkRequest [ REQUEST id=25, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1010114 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 10194 activeRequest: null callbackRequest: 26 [NetworkRequest [ REQUEST id=27, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10194 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 10192 activeRequest: null callbackRequest: 28 [NetworkRequest [ REQUEST id=29, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10192 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 10182 activeRequest: null callbackRequest: 30 [NetworkRequest [ REQUEST id=31, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10182 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 10179 activeRequest: null callbackRequest: 32 [NetworkRequest [ REQUEST id=33, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10179 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 10130 activeRequest: null callbackRequest: 34 [NetworkRequest [ REQUEST id=35, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10130 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 10116 activeRequest: null callbackRequest: 36 [NetworkRequest [ REQUEST id=37, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10116 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 10114 activeRequest: null callbackRequest: 38 [NetworkRequest [ REQUEST id=39, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10114 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 1010115 activeRequest: null callbackRequest: 40 [NetworkRequest [ REQUEST id=41, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1010115 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 10115 activeRequest: null callbackRequest: 42 [NetworkRequest [ REQUEST id=43, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10115 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 1010194 activeRequest: null callbackRequest: 44 [NetworkRequest [ REQUEST id=45, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1010194 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 activeRequest: null callbackRequest: 46 [NetworkRequest [ REQUEST id=47, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1000 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 48 [NetworkRequest [ LISTEN id=48, [ Transports: CELLULAR|WIFI Capabilities: NOT_VPN RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 1 order: 2147483647
  uid/pid:1073/5123 activeRequest: null callbackRequest: 49 [NetworkRequest [ REQUEST id=50, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1073 RequestorUid: 1073 RequestorPkg: com.android.networkstack UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1073/5123 activeRequest: null callbackRequest: 51 [NetworkRequest [ LISTEN id=51, [ Transports: WIFI Capabilities: NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 1073 RequestorUid: 1073 RequestorPkg: com.android.networkstack UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1073/5123 activeRequest: null callbackRequest: 52 [NetworkRequest [ TRACK_SYSTEM_DEFAULT id=52, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED RequestorUid: 1073 RequestorPkg: com.android.networkstack.tethering UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 53 [NetworkRequest [ LISTEN id=53, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 54 [NetworkRequest [ REQUEST id=55, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 56 [NetworkRequest [ LISTEN id=56, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 57 [NetworkRequest [ REQUEST id=58, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 59 [NetworkRequest [ LISTEN id=59, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 60 [NetworkRequest [ REQUEST id=61, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1001/5209 activeRequest: null callbackRequest: 62 [NetworkRequest [ LISTEN id=62, [ Transports: WIFI Capabilities: INTERNET&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 1001 RequestorUid: 1001 RequestorPkg: com.android.phone UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1001/5209 activeRequest: null callbackRequest: 63 [NetworkRequest [ REQUEST id=64, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1001 RequestorUid: 1001 RequestorPkg: com.android.phone UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1001/5209 activeRequest: null callbackRequest: 65 [NetworkRequest [ LISTEN id=65, [ Transports: WIFI Capabilities: INTERNET&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 1001 RequestorUid: 1001 RequestorPkg: com.android.phone UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1001/5209 activeRequest: null callbackRequest: 66 [NetworkRequest [ REQUEST id=67, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1001 RequestorUid: 1001 RequestorPkg: com.android.phone UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 70 [NetworkRequest [ LISTEN id=70, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 71 [NetworkRequest [ REQUEST id=72, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 73 [NetworkRequest [ LISTEN id=73, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 74 [NetworkRequest [ REQUEST id=75, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 76 [NetworkRequest [ LISTEN id=76, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:10145/4858 activeRequest: null callbackRequest: 77 [NetworkRequest [ REQUEST id=78, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10145 RequestorUid: 10145 RequestorPkg: com.android.systemui UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1001/5209 activeRequest: null callbackRequest: 79 [NetworkRequest [ LISTEN id=79, [ Capabilities: NOT_RESTRICTED&TRUSTED&NOT_VPN&VALIDATED&NOT_VCN_MANAGED Uid: 1001 RequestorUid: 1001 RequestorPkg: com.android.ons UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 activeRequest: null callbackRequest: 83 [NetworkRequest [ REQUEST id=84, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 1000 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 10170 activeRequest: null callbackRequest: 87 [NetworkRequest [ REQUEST id=88, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10170 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:10170/7433 activeRequest: null callbackRequest: 89 [NetworkRequest [ LISTEN id=89, [ Transports: CELLULAR|WIFI Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VPN&FOREGROUND&NOT_VCN_MANAGED Uid: 10170 RequestorUid: 10170 RequestorPkg: com.x8bit.bitwarden UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 10110 activeRequest: null callbackRequest: 117 [NetworkRequest [ REQUEST id=118, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10110 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
  uid/pid:1000/4589 asUid: 10112 activeRequest: null callbackRequest: 122 [NetworkRequest [ REQUEST id=123, [ Capabilities: INTERNET&NOT_RESTRICTED&TRUSTED&NOT_VCN_MANAGED Uid: 10112 RequestorUid: 1000 RequestorPkg: android UnderlyingNetworks: Null] ]] callback flags: 0 order: 2147483647
exit_code=0
```

## adb shell $cmd
```

exit_code=0
```

## adb shell $cmd
```

exit_code=0
```

## adb shell $cmd
```

exit_code=0
```

## adb shell $cmd
```
adb.exe :   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
At X:\47network\apps\openclaw-sven\sven_v0.1.0\scripts\ops\mobile\capture-android-network-dns-diagnostic.ps1:48 char:15
+     $output = & $AdbPath @args 2>&1
+               ~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ...  Time  Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload   Total   Spent    Left  Speed

  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0curl: (6) Could not resolve host: 
example.com
exit_code=6
```


