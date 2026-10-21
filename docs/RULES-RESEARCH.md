# Joker, seventh patti, and the family rules

Researched 21 October 2026. Twenty-Nine has regional variants rather than one universally binding rule book.

## Evidence

[Pagat: bidding and reverse](https://www.pagat.com/jass/29.html#bidding) distinguishes Joker **no-trump** selection from reverse-ranking play. Joker belongs to the trump indicators; the playing pack remains 32 cards. Ordinary no-trump retains J–9–A–10–K–Q–8–7; the led suit determines the winner, and Royals cannot be declared. Reverse play is separate: seven high and jack low, with unchanged card values. Some regional rules distinguish normal and reverse no-trump through different indicators.

[World of Card Games: seventh-card announcement](https://worldofcardgames.com/blog/2015/02/seventh-card-option-in-twenty-nine) describes setting aside the actual seventh dealt card, its suit determining trump. The bidder may discard while unable to follow without exposing it. Playing the reserved card opens trump.

[World of Card Games: current tutorial, Seventh Card section](https://worldofcardgames.com/twenty-nine/tutorial/) explains that the reserved card returns to the bidder’s hand on exposure. Before that it cannot lead unless it is the bidder’s last card. Another player unable to follow reveals trump as usual.

[Pagat: seventh card](https://www.pagat.com/jass/29.html#seventh) says the bidder may inspect the reserved card. Follow-suit obligations initially use only the remaining hand; if the led suit matches the reserved card and no matching ordinary card exists, the bidder may discard or expose and follow with that card.

## Applied to this app

The color picker now offers four suits, **Joker / No trump**, and **7th patti**. Joker does not reverse ranking. Seventh-patti selection occurs before the second deal; the server reserves position seven, not a card chosen by the player. Other players see its count but never its face or suit before exposure. The bidder can inspect the private reserved card, play it when eligible, or use **Open color**. Revealing returns it to the hand and recalculates legal cards. Opening does not consume a play or change whose turn it is. A face-down indicator appears alongside the table.

The family’s opening bid of 17 and Increase/Stay/Drop/Custom auction remain as requested. The game keeps 28 scoring points and no last-trick bonus. The sources differ on some scoring and regional cancellation details, so this update does not add automatic redeals, no-trump reverse, doubles/redoubles, single hand, or Bangladesh-specific annulment conditions. These are separate variants, not prerequisites for Joker or seventh patti.

## Validation

Tests cover indicator secrecy, exact seventh-card selection, follow-suit restrictions, voluntary bidder exposure, opponent-triggered exposure, final-card leading, absence of Royals in no-trump play, and 400 complete variant hands with conserved cards and points.
