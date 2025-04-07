# Homebridge-Broadlink-RM-PoC

## What is this?
As the name implies, this repository is to prove the efficiencies of my Pull-Requests(PRs), and to share them with ___developers___.

The findings are based the issues on [original](https://github.com/lprhodes/homebridge-broadlink-rm) and [base](https://github.com/kiwi-cam/homebridge-broadlink-rm), and pulled to base repository. Although almost of them were silently rejected like falling into a Black Hole, I don't mind. The maintainer should keep the repository within his manageable range.

In other words, here is a graveyard of my PRs, but they are working 24 hours a day, 365 days a year.

## My thoughts to original

The [original](https://github.com/lprhodes/homebridge-broadlink-rm) is designed ___amazingly well___ in the early era of [Homebridge](https://github.com/homebridge/homebridge). The [author](https://github.com/lprhodes) efficiently managed group of accessories with its own functions. But with progress of development of Homebridge, those own functions are outdated and needed to be up to date.

## Notice to developers

1. ___room/scene/automation___ of conventional plugins will be lost. Use your development environment for the experiments.
1. I'm only interested in the accessories of ___air-conditioner, switch, light, learn-code and tv___, since not using others. No changes were made for the others and should work as in conventional.
1. Welcome PRs for the issues and/or your improvements.

## Changes to original/base repositories (&#x2611; marged to base)

1. &#x2611; group light accessories which states are mutually exclusive ([base#445](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/445)).
1. &#x2611; air-conditioner accessory to turn off automatically after onDuration seconds ([base#446](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/446)).
1. &#x2610; EVE history view of target-temperature/mode for air-conditioner accessory ([base#452](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/452)).
1. &#x2611; ___fixed bug___ in counting reachability of broadlink devices ([base#459](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/459)).
1. &#x2610; skip pinging to unreferenced devices in config to reduce network traffic ([base#460](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/460)).
1. &#x2610; sync status between plugins using MQTT for air-conditioner accessory ([base#469](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/469)).
1. &#x2611; allowed missing IR/RF command in advanced HEX ([base#519](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/519)).
1. &#x2611; enabled broadlink device to send simultaneous IR/RF commands ([base#520](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/520)).
1. &#x2610; ___scene/automation___ for accessories with ___multiple IR/RF commands (e.g. tv)___ to work ([base#528](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/528)).
1. &#x2610; Sync channel selection of tv accessory when powered-on to support scene/automation ([base#529](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/529)).
1. &#x2610; +/- controls of brightness/hue for light accessory ([base#530](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/530)).
1. &#x2610; ___fixed bug___ that throws error on turning off air-conditioner configuring auto heat/cool temperature ([base#658](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/658)).
1. &#x2610; ___fixed bug___ that default minStep of target temperature for air-conditioner does not take effect until re-starting ([base#662](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/662)).
1. &#x2610; take closest target temperature in config to support floating point minStep ([base#663](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/663)). also for Fahrenheit.
1. &#x2610; EVE history view of switch/light accessories (disabled in EVE as of now).
1. &#x2610; ___AUTO mode___ for air-conditioner to work.
1. &#x2610; moved to ___dynamic platform plugin___ to ___keep room/scene/automation___ in failing to re-start ([base#664](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/664)).
1. &#x2610; switched to native Homebridge accessory status persisting except tv.
1. &#x2610; refactored broadlinkjs-rm library referencing to python-broadlink so that ___IR/RF commands___ would return the results of ___failure or success___.
1. &#x2610; IR/RF command ___failure___ would ___revert___ accessory status.
1. &#x2610; ___learning RF code to work___.
1. &#x2610; learning RF code for ___specified frequency___ ([base#706](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/706)).
1. &#x2611; ___fixed bug___ that version of v62093 broadlink firmware to fail in authentication ([base/broadlinkjs-rm#24](https://github.com/kiwi-cam/broadlinkjs-rm/pull/24)).
1. &#x2610; lock status of broadlink devices to be detected automatically and warn to unlock ([base/broadlinkjs-rm#25](https://github.com/kiwi-cam/broadlinkjs-rm/pull/25)).
1. &#x2610; Homebridge won't show ___'slows down'___ messages for characteristics of 'Current Temperature' or 'Current Relative Humidity' any more.
1. &#x2610; publish/receive accessory statuses of air-conditioner, switch, light and tv via MQTT.
1. &#x2610; consistent logging for which internal structures are refactored.
1. &#x2610; removed deprecated accessories of switch-multi, switch-multi-repeat, switch-repeat.
1. &#x2610; removed W1Device from air-conditioner accessory. similar but different functions for two temperature text interfaces are redundant.
1. &#x2610; removed battery related properties from air-conditioner accessory of which physical device does not have a battery.
1. &#x2610; introduced ___characteristic___ property of mqttTopic to resolve a ___whack-a-mole solution___ ([base#467](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/467)) for MQTT temperature identifier.
1. &#x2610; keep input source ___order___ in config for tv accessory. ___renaming or hiding___ are also supported.
1. &#x2610; re-enabled/extended unit tests and perform them as regression test in pushing to github.
1. &#x2610; fixed linting rules and errors.
1. &#x2610; completely refactored air-conditioner accessory to improve the reliabilities.
1. &#x2610; set accessories associating with ___offline device___ to ___inacctive___ ([base#742](https://github.com/kiwi-cam/homebridge-broadlink-rm/issues/742)).
1. &#x2610; removed offDry mode of air-conditioner accessory. implemented context HEX for the replacement.
1. &#x2610; unified config properties and removed redundant or ambiguous.
1. &#x2610; verify config comprehensively. unknown properties are reported in debug mode while revised conventional properties are always despite the mode.

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
