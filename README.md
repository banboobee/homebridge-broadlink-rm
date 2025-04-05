# Homebridge-Broadlink-RM-PoC

## What is this?
As the name implies, this repository is to prove the efficiencies of my Pull-Requests(PRs), and to share them with ___developers___.
The findings are based the issues on [original](https://github.com/lprhodes/homebridge-broadlink-rm) and [base](https://github.com/kiwi-cam/homebridge-broadlink-rm), and pulled to base repository. Although almost of them were silently rejected like falling into a Black Hole, I don't mind. The maintainer should keep the repository within his manageable range. But they are working 24 hours a day, 365 days a year.

## My thought to original

The [original](https://github.com/lprhodes/homebridge-broadlink-rm) is designed ___amazingly well___ in the early era of [Homebridge](https://github.com/homebridge/homebridge). The [author](https://github.com/lprhodes) efficiently managed group of accessories with its own functions. But with progress of development of Homebridge, those own functions are outdated and needed to be up to date.

## Notice for developers

1. Scene or automation of conventional plugins will be lost. Use your development environment for the experiments.
2. I'm only interested in the accessories of air-conditioner, switch, light, learn-code and tv, since not using others. No changes were made for the others and should work as conventional.
3. Welcome PRs for the issues and/or your improvements.

## Changes to original/base repository

1. group light accessories which states are mutually exclusive.
2. air-conditioner accessory to turn off automatically after onDuration seconds.
3. EVE history view of target temperature and mode for air-conditioner accessory (kiwi-cam#452).
4. EVE history view of light accessory (unfortunately, disabled in EVE as of now).
5. lock status of broadlink devices to be detected automatically and warn to unlock. 

## Thanks
@lprhodes (https://github.com/lprhodes/homebridge-broadlink-rm) for your original work.
