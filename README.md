# Homebridge-Broadlink-RM-PoC

## What is this?
As the name implies, [this](https://github.com/banboobee/homebridge-broadlink-rm) repository is to prove the efficiencies of my Pull-Requests(PRs), and to share them with ___developers___.

The findings are based the issues on [original](https://github.com/lprhodes/homebridge-broadlink-rm) and [base](https://github.com/kiwi-cam/homebridge-broadlink-rm), and pulled to base repository. Although almost of them were silently rejected like falling into a Black Hole, I don't mind. The maintainer should keep the repository within his manageable range.

In other words, here is a graveyard of my PRs, but they are working 24 hours a day, 365 days a year.

## My thoughts to original

The [original](https://github.com/lprhodes/homebridge-broadlink-rm) is designed ___amazingly well___ in the early era of [Homebridge](https://github.com/homebridge/homebridge). The [author](https://github.com/lprhodes) efficiently managed group of accessories with its own functions. But with progress of development of Homebridge, those own functions are outdated and needed to be up to date.

## Notice to developers

1. ___room/scene/automation___ of conventional plugins will be lost. Use your development environment for the experiments.
2. I'm only interested in the accessories of ___air-conditioner, switch, light, learn-ir, learn-code and tv___, since not using others. No changes were made for the others and should work as in conventional.
3. Welcome PRs for the issues and/or your improvements.

## Improvements  to original/base repositories (least recent. &#x2611; marged to base)

1. &#x2611; group light accessories which states are mutually exclusive ([base#445](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/445)).
2. &#x2611; air-conditioner accessory to turn off automatically after onDuration seconds ([base#446](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/446)).
3. &#x2610; Homebridge won't complain ___'slows down'___ (e.g. [base#740](https://github.com/kiwi-cam/homebridge-broadlink-rm/issues/740)) any more for characteristics of 'Current Temperature' or 'Current Relative Humidity'.
4. &#x2610; EVE history view of target-temperature/mode for air-conditioner accessory ([base#452](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/452)).
5. &#x2611; ___fixed bug___ in counting reachability of broadlink devices ([base#459](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/459)).
6. &#x2610; skip pinging to unreferenced devices in config to reduce network traffic ([base#460](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/460)).
7. &#x2610; sync status between plugins using MQTT for air-conditioner accessory ([base#469](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/469)).
8. &#x2611; allowed missing IR/RF command in advanced HEX ([base#519](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/519)).
9. &#x2611; enabled broadlink device to send simultaneous IR/RF commands ([base#520](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/520)).
10. &#x2610; ___scene/automation___ for accessories with ___multiple IR/RF commands___ (e.g. tv) to work ~~([base#528](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/528))~~ ~~([base#610](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/610))~~ ([this#PR4.4.11-3](https://github.com/banboobee/homebridge-broadlink-rm/tree/PR4.4.11-3)).
11. &#x2610; Sync channel selection of tv accessory when powered-on to support scene/automation ([base#529](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/529)).
12. &#x2610; +/- controls of brightness/colorTemperature for light accessory (e.g. [original#292](https://github.com/lprhodes/homebridge-broadlink-rm/issues/292), [original#57](https://github.com/lprhodes/homebridge-broadlink-rm/issues/57), [original#389](https://github.com/lprhodes/homebridge-broadlink-rm/issues/389)) ([base#530](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/530)).
13. &#x2610; publish/receive accessory statuses of air-conditioner, switch, light and tv via MQTT.
14. &#x2610; ___fixed bug___ that throws error on turning off air-conditioner configuring auto heat/cool temperature ([base#658](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/658)).
15. &#x2610; ___fixed bug___ that default minStep of target temperature for air-conditioner does not take effect until re-starting (e.g. [base#605](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/605)) ([base#662](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/662)).
16. &#x2610; take closest target temperature in config to support floating point minStep ([base#663](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/663)). also for Fahrenheit.
17. &#x2610; EVE history view of switch/light accessories (disabled in EVE as of now).
18. &#x2610; ___AUTO mode___ for air-conditioner (e.g. [base#756](https://github.com/kiwi-cam/homebridge-broadlink-rm/issues/756)) to work.
19. &#x2610; moved to ___dynamic platform plugin___ to ___keep room/scene/automation___ (e.g. [base#609](https://github.com/kiwi-cam/homebridge-broadlink-rm/issues/609)) in failing to re-start ([base#664](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/664)).
20. &#x2610; switched to native Homebridge accessory status persisting except tv.
21. &#x2610; refactored broadlinkjs-rm library referencing to python-broadlink so that ___IR/RF commands___ would return the results of ___failure or success___.
22. &#x2610; IR/RF command ___failure___ would ___revert___ accessory status.
23. &#x2610; ___learning RF code___ (e.g. [base#45](https://github.com/kiwi-cam/homebridge-broadlink-rm/issues/45), [base#753](https://github.com/kiwi-cam/homebridge-broadlink-rm/issues/753) and [base#387](https://github.com/kiwi-cam/homebridge-broadlink-rm/issues/387#issuecomment-1146733780)) to work.
24. &#x2610; learning RF code for ___specified frequency___ (e.g. [base#676](https://github.com/kiwi-cam/homebridge-broadlink-rm/issues/676)) ([base#706](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/706)).
25. &#x2611; ___fixed bug___ that version of v62093 broadlink firmware (e.g. [base#580](https://github.com/kiwi-cam/homebridge-broadlink-rm/issues/580), [base#598](https://github.com/kiwi-cam/homebridge-broadlink-rm/issues/598)) to fail in authentication ([base/broadlinkjs-rm#24](https://github.com/kiwi-cam/broadlinkjs-rm/pull/24)).
26. &#x2610; lock status of broadlink devices to be detected automatically and warn to unlock ([base/broadlinkjs-rm#25](https://github.com/kiwi-cam/broadlinkjs-rm/pull/25)).
27. &#x2610; consistent logging for which internal structures are refactored.
28. &#x2610; removed deprecated accessories of switch-multi, switch-multi-repeat, switch-repeat.
29. &#x2610; removed W1Device from air-conditioner accessory. similar but different functions for two temperature text interfaces are redundant.
30. &#x2610; removed battery related properties from air-conditioner accessory of which physical device does not have a battery.
31. &#x2610; introduced ___characteristic___ property of mqttTopic to resolve a ___whack-a-mole solution___ ([base#467](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/467)) for MQTT temperature identifier.
32. &#x2610; keep input source ___order___ in config for tv accessory. ___renaming or hiding___ are also supported.
33. &#x2610; re-enabled/extended unit tests and perform them as regression test in pushing to github.
34. &#x2610; fixed linting rules and errors.
35. &#x2610; completely refactored air-conditioner accessory to improve the reliabilities.
36. &#x2610; set accessories associating with ___offline device___ to ___inacctive___ ([base#742](https://github.com/kiwi-cam/homebridge-broadlink-rm/issues/742)).
37. &#x2610; removed offDry mode of air-conditioner accessory. implemented context HEX for the replacement.
38. &#x2610; tidied up config properties. removed redundant and ambiguous.
39. &#x2610; verify config comprehensively to help proper configuration (e.g. [base#655](https://github.com/kiwi-cam/homebridge-broadlink-rm/issues/655)). unknown properties are reported in debug mode while revised conventional properties are always despite the mode.
40. &#x2610; ignored invalid temperature reporting of bradlink device ([home-assistant/core#50098](https://github.com/home-assistant/core/pull/50098)).
41. &#x2610; prevented ___'illegal value: null'___ for 'Current Relative Humidity' characteristic (e.g. [base#680](https://github.com/kiwi-cam/homebridge-broadlink-rm/issues/680)) without noHumidity property.

#### Summary
| code                    | improvements | Unit<br>test | EVE<br>history<br>views | MQTT<br>subscribe/<br>publish | fixing<br>lint | tidy-up<br>config | verify<br>config | config<br>scheme |
|:-----------------------:|:------------:|:------------:|:-----------------------:|:-----------------------------:|:--------------:|:-----------------:|:----------------:|:----------------:|
| platform                | &#x2714;     | &#x2714;     | -                       | -                             | &#x2714;       | &#x2714;          | &#x2714;         | &#x2610;         |
| air-conditioner         | &#x2714;     | &#x2714;     | &#x2714;                | &#x2714;                      | &#x2714;       | &#x2714;          | &#x2714;         | &#x2610;         |
| switch                  | &#x2714;     | &#x2714;     | &#x2714;                | &#x2714;                      | &#x2714;       | &#x2714;          | &#x2714;         | &#x2610;         |
| light                   | &#x2714;     | &#x2714;     | &#x2714;                | &#x2714;                      | &#x2714;       | &#x2714;          | &#x2714;         | &#x2610;         |
| tv                      | &#x2714;     | &#x2714;     | -                       | &#x2714;                      | &#x2714;       | &#x2714;          | &#x2714;         | &#x2610;         |
| learn-ir                | &#x2714;     | &#x2714;     | -                       |                               | &#x2714;       | &#x2714;          | &#x2714;         | &#x2610;         |
| learn-code              | &#x2714;     | &#x2714;     | -                       |                               | &#x2714;       | &#x2714;          | &#x2714;         | &#x2610;         |
| switch-multi            | removed      | removed      |                         |                               | -              | -                 | -                | -                |
| switch-repeat           | removed      | -            |                         |                               | -              | -                 | -                | -                |
| switch-multi-repeat     | removed      | -            |                         |                               | -              | -                 | -                | -                |
| garage-door-opener      |              | &#x2714;     |                         |                               |                |                   |                  |                  |
| lock                    |              | &#x2714;     |                         |                               |                |                   |                  |                  |
| fan                     |              | &#x2714;     |                         |                               |                |                   |                  |                  |
| outlet                  |              | &#x2714;     |                         |                               |                |                   |                  |                  |
| window-covering         |              | &#x2714;     |                         |                               |                |                   |                  |                  |
| window                  |              | -            |                         |                               | -              | -                 | -                |                  |
| fanv1                   |              |              |                         |                               |                |                   |                  |                  |
| air-purifier            |              |              |                         |                               |                |                   |                  |                  |
| humidifier-dehumidifier |              |              |                         |                               |                |                   |                  |                  |
| temperatureSensor       |              |              |                         |                               |                |                   |                  |                  |
| humiditySensor          |              |              |                         |                               |                |                   |                  |                  |
| heater-cooler           |              |              |                         |                               |                |                   |                  |                  |

## ToDo
- [x] collect available config properties
- [x] unifiy config properties
- [x] verify config properties
- [ ] config.schema.json

## Known issues
- [ ] broadlink device disconnect/connect periodically ([python-broadlink#641](https://github.com/mjg59/python-broadlink/issues/641))

## Thanks
- [@lprhodes](https://github.com/lprhodes/homebridge-broadlink-rm) for your amazing original work.
- [@felipediel](https://github.com/mjg59/python-broadlink/commits?author=felipediel) for the implementation reference of python-broadlink.
