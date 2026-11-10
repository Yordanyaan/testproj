# Cyberpunk Platformer

A browser side-scrolling platformer set in a neon cyberpunk city: the player runs and jumps through a Level, collects Credits and defeats Enemies on the way to the Exit.

## Language

### Characters

**Runner**:
The character the player controls.
_Avoid_: Persona, player, hero, character

**Enemy**:
A hostile character in a Level that damages the Runner on contact and can be defeated with a Stomp.
_Avoid_: Monster, mob, baddie

**Patrol Bot**:
An Enemy that walks along a platform, turning back at edges and walls.
_Avoid_: Walker, crawler, goomba

**Hover Drone**:
An Enemy that floats in the air, bobbing up and down.
_Avoid_: Flyer, bird, bat

### World

**Level**:
A single hand-built stage the Runner travels through from its start to its Exit.
_Avoid_: Stage, map, world

**Exit**:
The point at the end of a Level that the Runner reaches to complete it.
_Avoid_: Goal, finish, flag

**Credit**:
A collectible scattered through a Level; collecting them is the player's score.
_Avoid_: Coin, money, point

**Pit**:
A gap in a Level with no floor; falling into one costs the Runner 1 Health and returns them to the last solid ground they stood on.
_Avoid_: Hole, gap, void

### Combat

**Stomp**:
Defeating an Enemy by landing on top of it.
_Avoid_: Jump attack, kill

**Hit**:
Any contact with an Enemy that is not a Stomp, or a fall into a Pit; each Hit costs the Runner 1 Health.
_Avoid_: Damage, hurt

**Recovery**:
The short period after a Hit during which the Runner blinks and cannot take another Hit.
_Avoid_: Invincibility, i-frames, cooldown

**Health**:
The number of Hits the Runner can take before the Level is Failed; the Runner starts with 3.
_Avoid_: HP, lives, hearts

### Outcomes

**Level Complete**:
The outcome when the Runner reaches the Exit.
_Avoid_: Win, victory, finish

**Level Failed**:
The outcome when the Runner's Health reaches 0; the Level restarts from the beginning.
_Avoid_: Game over, death, lose

**Record**:
The best time and the most Credits achieved on a Level in this browser.
_Avoid_: High score, best, leaderboard
