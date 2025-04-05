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

## Changes to original/base repository

1. group light accessories which states are mutually exclusive ([base#445](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/445)).
1. air-conditioner accessory to turn off automatically after onDuration seconds ([base#446](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/446)).
1. EVE history view of target-temperature/mode for air-conditioner accessory ([base#452](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/452)).
1. ___fixed bug___ in counting reachability of broadlink devices ([base#459](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/459)).
1. skip pinging to unreferenced devices in config to reduce network traffic ([base#460](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/460)).
1. sync status between plugins using MQTT for air-conditioner accessory ([base#469](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/469)).
1. allowed missing IR/RF command in advanced HEX ([base#519](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/519)).
1. made possible simultaneous IR/RF command sending of broadlink device ([base#520](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/520)).
1. ___scene/automation to work___ ([base#528](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/528)).
1. Sync channel selection of TV accessory when powered on to support scene/automation to work ([base#529](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/529)).
1. +/- controls of brightness/hue for light accessory ([base#530](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/530)).
1. ___fixed bug___ that throws error on turning off air-conditioner configuring auto heat/cool temperature ([base#658](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/658)).
1. ___fixed bug___ that default minStep of target temperature for air-conditioner does not take effect until re-start ([base#662](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/662)).
1. take closest target temperature in config to support floating point minStep. also for Fahrenheit. ([base#663](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/663)).
1. moved to ___dynamic platform plugin___ to ___keep room/scene/automation___ in failing to re-start ([base#664](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/664)).
1. ___learning RF code to work___.
1. learning RF code for ___specified frequency___ ([base#706](https://github.com/kiwi-cam/homebridge-broadlink-rm/pull/706)).
1. ___fixed bug___ that version of v62093 broadlink firmware to fail in authentication ([base/broadlinkjs-rm#24](https://github.com/kiwi-cam/broadlinkjs-rm/pull/24)).
1. lock status of broadlink devices to be detected automatically and warn to unlock ([base/broadlinkjs-rm#25](https://github.com/kiwi-cam/broadlinkjs-rm/pull/25)).
1. EVE history view of switch/light accessories (disabled in EVE as of now).

## Thanks
[@lprhodes](https://github.com/lprhodes/homebridge-broadlink-rm) for your amazing original work.
