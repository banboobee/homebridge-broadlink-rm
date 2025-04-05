# Homebridge-Broadlink-RM-PoC

## What is this?
As the name implies, this repository is to prove the efficiencies of my Pull-Requests(PRs), and to share them with ___developers___.

The findings are based the issues on [original](https://github.com/lprhodes/homebridge-broadlink-rm) and [base](https://github.com/kiwi-cam/homebridge-broadlink-rm), and pulled to base repository. Although almost of them were silently rejected like falling into a Black Hole, I don't mind. The maintainer should keep the repository within his manageable range.

Thus, here is a graveyard of my PRs, but they are working 24 hours a day, 365 days a year.

## My thoughts to original

The [original](https://github.com/lprhodes/homebridge-broadlink-rm) is designed ___amazingly well___ in the early era of [Homebridge](https://github.com/homebridge/homebridge). The [author](https://github.com/lprhodes) efficiently managed group of accessories with its own functions. But with progress of development of Homebridge, those own functions are outdated and needed to be up to date.

## Notice to developers

1. room/scene/automation of conventional plugins will be lost. Use your development environment for the experiments.
2. I'm only interested in the accessories of air-conditioner, switch, light, learn-code and tv, since not using others. No changes were made for the others and should work as conventional.
3. Welcome PRs for the issues and/or your improvements.

## Changes to original/base repository

1. group light accessories which states are mutually exclusive (kiwi-cam/homebridge-broadlink-rm#445).
2. air-conditioner accessory to turn off automatically after onDuration seconds (kiwi-cam/homebridge-broadlink-rm#446).
3. EVE history view of target-temperature/mode for air-conditioner accessory (kiwi-cam/homebridge-broadlink-rm#452).
4. ___fixed bug___ in counting reachability of broadlink devices (kiwi-cam/homebridge-broadlink-rm#459).
5. skip pinging to unreferenced devices in config to reduce network traffic (kiwi-cam/homebridge-broadlink-rm#460).
6. sync status between plugins using MQTT for air-conditioner accessory (kiwi-cam/homebridge-broadlink-rm#469).
7. allowed missing IR/RF command in advanced HEX (kiwi-cam#519).
8. made possible simultaneous IR/RF command sending of accessory for scene/automation to work (kiwi-cam/homebridge-broadlink-rm#520). deprecated
9. made possible simultaneous IR/RF command sending of broadlink device for ___scene/automation to work___ (kiwi-cam/homebridge-broadlink-rm#528).
10. Sync channel selection of TV accessory when powered on to support scene/automation to work (kiwi-cam/homebridge-broadlink-rm#529).
11. +/- controls of brightness/hue for light accessory (kiwi-cam/homebridge-broadlink-rm#530). 
12. ___fixed bug___ that throws error on turning off air-conditioner configuring auto heat/cool temperature (kiwi-cam/homebridge-broadlink-rm#658).
13. ___fixed bug___ that default minStep parameter of target temperature for air-conditioner does not take effect until re-start (kiwi-cam/homebridge-broadlink-rm#662).
14. take closest temperature in config for target temperature selection to support floating point minStep configuration. This may also help Fahrenheit configuration (kiwi-cam/homebridge-broadlink-rm#663).
15. moved to ___dynamic platform plugin___ from accessory plugin to ___keep room/scene/automation___ in failing to re-start (kiwi-cam/homebridge-broadlink-rm#664).
16. ___learning RF code to work___.
17. learning RF code for ___specified frequency to work___ (kiwi-cam/homebridge-broadlink-rm#706).
18. ___fixed bug___ that version of v62093 broadlink firmware to fail in authentication (kiwi-cam/broadlinkjs-rm#24).
19. lock status of broadlink devices to be detected automatically and warn to unlock (kiwi-cam/broadlinkjs-rm#25).
20. EVE history view of light accessory (disabled in EVE as of now).

## Thanks
[@lprhodes](https://github.com/lprhodes/homebridge-broadlink-rm) for your amazing original work.
