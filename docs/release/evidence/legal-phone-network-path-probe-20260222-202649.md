# Legal URL Phone Network Path Probe

Timestamp: 2026-02-22T20:26:49.7872747+02:00
Base URL: https://app.sven.example.com
Device: R58N94KML7J

## Wi-Fi path
```
adb.exe :   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
At X:\47network\apps\openclaw-sven\sven_v0.1.0\scripts\ops\mobile\capture-legal-phone-network-path-probe.ps1:56 char:15
+     $output = & $AdbPath @allArgs 2>&1
+               ~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ...  Time  Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload   Total   Spent    Left  Speed

  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0
  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:01 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:02 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:03 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:04 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:05 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:06 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:07 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:08 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:09 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:10 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:11 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:11 --:--:--     0
curl: (28) Connection timed out after 12000 milliseconds
adb.exe :   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
At X:\47network\apps\openclaw-sven\sven_v0.1.0\scripts\ops\mobile\capture-legal-phone-network-path-probe.ps1:56 char:15
+     $output = & $AdbPath @allArgs 2>&1
+               ~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ...  Time  Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload   Total   Spent    Left  Speed

  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0
  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:01 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:02 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:03 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:04 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:05 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:06 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:07 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:08 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:09 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:10 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:11 --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:12 --:--:--     0
curl: (28) Connection timed out after 12000 milliseconds
```

## Cellular path attempt
```
adb.exe :   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
At X:\47network\apps\openclaw-sven\sven_v0.1.0\scripts\ops\mobile\capture-legal-phone-network-path-probe.ps1:56 char:15
+     $output = & $AdbPath @allArgs 2>&1
+               ~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ...  Time  Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload   Total   Spent    Left  Speed

  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0curl: (6) Could not resolve host: 
app.sven.example.com
adb.exe :   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
At X:\47network\apps\openclaw-sven\sven_v0.1.0\scripts\ops\mobile\capture-legal-phone-network-path-probe.ps1:56 char:15
+     $output = & $AdbPath @allArgs 2>&1
+               ~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ...  Time  Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload   Total   Spent    Left  Speed

  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0curl: (6) Could not resolve host: 
app.sven.example.com
```

## Restore Wi-Fi
```
Wifi is enabled
Wifi scanning is only available when wifi is enabled
==== Primary ClientModeManager instance ====
Wifi is not connected
```

## Verdict
- Probe captured; compare timeout/DNS signatures across network paths.



