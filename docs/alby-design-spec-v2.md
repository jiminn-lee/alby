# alby Design Spec v2

## 1. Product Summary

alby is a mobile-first social music rating app centered on album recommendations from a user's immediate circle. Users follow people whose taste they trust, rate albums on a five-point scale with half-point precision, add optional notes, and save albums to a listen-later list.

The product should feel closer to a personal music diary shared with friends than a large public music database. alby is not trying to compete with Rate Your Music or Album of the Year on scale, depth, or public consensus. Its value is smaller, warmer, and more socially relevant: "What are the people I care about listening to, loving, saving, and recommending?"

This spec is a living document. Feature details marked as provisional may change as product direction and user-authored designs evolve.

## 2. MVP Goals

The first version should let a user:

- Create an account and sign in.
- Search for albums and artists.
- View album detail pages.
- Rate albums from 0.5 to 5.0.
- Add optional notes to a rating.
- Save albums to a listen-later list.
- Set the account to public or private.
- Follow and unfollow other users.
- See a feed of album activity from people they follow.
- View user profiles with rated albums and basic taste history.
- Open an album in Spotify from its album page.

## 3. Non-Goals for MVP

The first version should avoid:

- Importing listening history from Spotify, Apple Music, or Last.fm.
- Rating songs, artists, playlists, or concerts.
- Advanced public charts or global rankings.
- AI-powered taste comparison.
- Full editorial review publishing.
- Complex moderation, blocking, or reporting beyond basic account safety.
- Manual album database management tools.

## 4. Product Principles

### Friend-First Discovery

The feed should prioritize activity from followed users, especially people the user knows or intentionally follows. Broad public popularity should not dominate the experience.

### Albums Are the Core Object

Every major interaction should orbit albums: search, rating, notes, listen-later, feed activity, profile history, and external music links.

### Ratings Should Be Quick but Expressive

Half-point ratings provide nuance, while optional notes let users add context without making writing feel required.

### Social, Not Performative

The app should feel warm and intimate rather than competitive. Avoid heavy gamification, public score chasing, leaderboards, or overly analytical taste rankings in the MVP.

### A Feed You Can Act On

Feed items should make it easy to rate the album, save it for later, like/comment on the activity, or open the album detail page.

## 5. Design Authority and Handoff Model

The user is the source of truth for alby's visual direction. Future design work should be based on the user's completed Figma screens, color palette, typography, icon choices, spacing, screen layouts, and interaction details.

Codex and implementation agents should not invent a replacement visual system, reinterpret the user's direction, or generate new app screens unless the user explicitly asks for that work. The implementation role is to translate the finished Figma designs into Expo as faithfully as possible, while raising only practical mobile app concerns such as accessibility, tap target size, safe-area behavior, performance, and platform conventions.

When a design detail is missing from the finished Figma work, implementation should ask for clarification if the choice would materially affect the product's visual identity. Small engineering-only defaults may be chosen when they are invisible to users or clearly required for native app reliability.

## 6. Established User-Authored Design System

The Alby Figma file is the visual authority. The Home, User, Album Detail, Rating Composer, and Assets and Colors frames establish the current palette, type hierarchy, disc treatment, spacing, and interaction patterns.

For new screens, derive implementation tokens from that source:

- Colors should come from the user's palette and actual Figma usage.
- Typography should follow the user's selected typefaces, sizes, weights, line heights, and hierarchy.
- Spacing, sizing, radius, border, and elevation values should be measured from the Figma designs and normalized only when doing so preserves the user's intent.
- Icons and custom marks should use the user's chosen icon set or supplied assets.
- Navigation structure and presentation should follow the user's completed app screens.
- Component abstractions in Expo should be created only after the visual patterns are clear from the user's designs.
- The Alby wordmark follows Figma node `34:139`: a 32px golden disc behind a canvas-colored 24px circle with an 8px blur, then the Playfair Display wordmark.
- Primary buttons use the brand fill with canvas-colored text and icons. Secondary buttons use the border fill, white outline, and ink-colored content.
- All visible pressable controls use a shared pressed opacity of `0.5`; disabled styling remains a separate state.

Neutral mobile implementation guardrails:

- Text must remain readable on mobile devices and support dynamic type where practical.
- Interactive controls should provide at least a 44px by 44px touch target.
- Screens must respect safe areas, device notches, home indicators, and keyboard appearance.
- On iOS, show the dark system status bar and apply the top safe-area inset before the screen's measured Figma padding.
- Persistent bottom navigation extends its background behind the home indicator while keeping controls above the bottom safe-area inset.
- Repeated rows and feeds should preserve stable alignment lanes to avoid jitter.
- Loading states should reserve final layout dimensions to avoid visible layout shift.
- Images and album artwork should preserve aspect ratio and avoid unintended cropping.
- Rating controls must expose numeric accessibility labels such as `4.5 out of 5`.
- Privacy states must be understandable without relying on color alone.
- Motion should respect reduced-motion settings.

## 7. Navigation Model

The final navigation presentation should follow the user's completed designs. The routes below describe functional destinations, not a committed tab count, icon set, label treatment, or layout pattern.

### Primary Destinations

- Home: friend activity feed.
- Explore: album and user search.
- Profile: current user's profile and ratings.

### Secondary Routes

- Album detail.
- User profile.
- Rating composer.
- Listen Later inside Profile.
- Followers/following lists.
- Settings.
- Notifications.

Listen Later remains a core behavior. Its final placement should follow the user's finished navigation design.

## 8. Core Entities

### User

Represents an account and public-facing profile.

Key fields:

- Display name.
- Username.
- Avatar.
- Bio.
- Account-level profile privacy.

### Album

Represents an album in alby's internal database.

Key fields:

- Title.
- Artist name.
- Cover image URL.
- Release date.
- Release type (`album` or `ep`).
- Spotify ID.
- Spotify URL.
- Additional external service URLs, if supported later.
- Track count and metadata, if available from source.

Albums should be created in Supabase when a user interacts with a Spotify result, so alby has stable internal album records.

### Rating

Represents a user's rating of an album.

Key fields:

- User.
- Album.
- Rating value from 0.5 to 5.0.
- Optional note.
- Created date.
- Updated date.

Users may rate the same album more than once. Each submission is retained as rating history, with the newest rating treated as current. Deleting the current rating reveals the next newest rating, if one exists.

### Listen-Later Item

Represents an album saved for future listening.

Key fields:

- User.
- Album.
- Created date.
- Optional status in the future.

### Follow

Represents one user following another user.

Key fields:

- Follower.
- Followed user.
- Created date.

Follower/following is preferred over a strict friend model because it supports asymmetric taste discovery while still allowing mutual-only privacy.

### Feed Activity

Represents social events shown in the home feed.

Activity types:

- User rated an album.
- User saved an album for later.
- User added or updated a note.
- Future: user listened, ranked, or recommended an album.

## 9. Privacy Rules

### Account Privacy

Profiles are public by default and may be switched to private at the account level. Per-rating and per-save visibility controls are intentionally excluded.

- Public profile: ratings, notes, saved albums, and activity are readable by authenticated users.
- Private profile: ratings, notes, saved albums, and activity are readable only by the owner and mutual follows.
- Basic identity and aggregate counts remain discoverable for private profiles.
- Likes and comments inherit the visibility of their activity event.

### Rating Aggregates

- Global Rating includes ratings authored by public profiles only.
- Friend Rating includes visible ratings from mutual follows only.
- The profile Rank value remains unresolved and displays `?`.

## 10. Primary User Flows

### Onboarding

1. User creates account.
2. User sets display name, username, and avatar.
3. User optionally follows suggested users or skips.
4. User lands on Home.

MVP onboarding can be minimal. The app should not require music import or taste calibration.

### Explore and Rate Album

1. User opens Explore.
2. User searches for an album or artist.
3. User selects an album result.
4. App opens Album Detail.
5. User reviews album information, friend/global ratings, and their own rating state.
6. If unrated, user drags or taps the disc rating control to select a half-point rating from 0.5 to 5.0.
7. User optionally writes a note.
8. User confirms rating.
9. Rating appears on the album page, profile, and eligible follower feeds.

### Feed Post to Album

1. User opens Home.
2. User sees a post involving an album.
3. User taps the album title.
4. App opens Album Detail for that album.
5. User can open the album on Spotify, add it to Listen Later, share it, or rate it.

### Save for Later

1. User finds an album from search, feed, or album detail.
2. User taps Listen Later.
3. Album is added to listen-later list.
4. Saved album appears in the Saved tab inside Profile and follows account-level privacy.

### Follow a User

1. User finds another user from search, feed, or profile.
2. User opens their profile.
3. User taps Follow.
4. That user's eligible activity appears in Home.

### Feed Interaction

1. User opens Home.
2. User scans friend activity.
3. User can like/comment on an activity.
4. User can rate the album directly.
5. User can save the album for later.
6. User can tap the album title to open the album page or tap through to the posting user's profile.

## 11. Screen Inventory

### Home Feed

Purpose: show recent album activity from followed users.

Required content:

- alby wordmark.
- Notification entry point.
- Feed items with user/action text.
- Album cover.
- Artist name.
- Album title.
- Rating display, when applicable.
- Optional note excerpt.
- Rate action.
- Save/listen-later action.
- Like/comment counts.
- Timestamp.
- Primary navigation as shown in the user's final design.

### Explore/Search

Purpose: help users search for music and discover albums beyond the home feed.

Required content:

- Search field for albums and artists.
- Album results with cover, title, artist, year, and quick action.
- New releases section.
- Recently rated by friends section.
- Empty state before search.
- No-results state.

Provisional behavior:

- Selecting an album from search or discovery opens Album Detail.
- Selecting an artist may open a filtered results screen or detail page; final behavior is TBD.

### Album Detail

Purpose: give one album a stable home in alby.

Required content:

- Cover art.
- Album title.
- Artist.
- Release year/date.
- Album information and metadata.
- Spotify button that opens the album's Spotify page.
- Listen Later button in the unrated state.
- Share button.
- Friend Rating: the average rating from the user's friends.
- Global Rating: the average rating across all eligible ratings for the album.
- User's rating state.
- Unrated state that lets the user drag or tap to fill rating discs out of 5, with half values allowed.
- Optional note field when adding or editing the user's rating.
- Save/confirm affordance for the user's rating.
- Notes/ratings from followed users.
- Recent activity involving the album.

Provisional behavior:

- Album Detail can be reached from a Home feed post by tapping the album title.
- Album Detail can also be reached from Explore after searching for or discovering the album.
- Album Detail hides primary bottom navigation. Back returns to the previous route, or Home when opened directly.
- Friend Rating uses mutual follows; Global Rating uses public-profile ratings only.
- If the user has already rated the album, replace Rate with Rate Again, hide Listen Later, and pin the user's newest rating above older personal ratings and friend activity.
- Friend and Global values use the dedicated 24px aggregate disc variant with its right half masked.
- The three-dot menu on a personal rating exposes deletion. Deleting the user's only rating returns the album to its unrated actions.
- Friend and Global averages use only each eligible user's newest rating so rating history does not give one person extra weight.
- Spotify is the first committed external music destination; other services can be added later if supported by the final product direction.

### Rating Composer

Purpose: quickly rate an album and optionally add a note.

Required content:

- Album summary.
- Half-point rating disc control.
- Optional note field.
- Save button.
- Every submission creates a new rating-history entry. Deletion is available from the rating's three-dot menu on Album Detail.

The composer should feel light and fast, not like writing a formal review.

The current composer is a 345px-wide, approximately 288px-tall modal with 24px padding, a 64px album row, five centered 40px rating discs separated by 8px, a 72px note field, and compact 31px actions. Album metadata uses `Artist • Year • Track count` above the title.

### Listen Later

Purpose: manage albums the user wants to hear later from inside Profile.

Listen Later is available only while the user has no ratings for the album. Creating a rating removes the active saved item but preserves its historical first-save activity; deleting every rating makes the album eligible to save again.

Required content:

- Saved albums list.
- Album cover, title, artist.
- Rate action.
- Remove action.
- Sorting/filtering, likely "Recently saved" first.

### Profile

Purpose: show a user's taste and activity.

Required content:

- Avatar.
- Display name and username.
- Bio.
- Follow/following counts.
- Follow button or edit profile button.
- Rated albums.
- Listen-later preview if visible.
- Recent notes/activity.

Potential profile tabs:

- Ratings.
- Notes.
- Listen Later.

### Notifications

Purpose: show social feedback.

Required content:

- New followers.
- Likes.
- Comments.
- Future: mutual follow events or friend rating same album.

Notifications can be lightweight for MVP.

### Settings

Purpose: manage account and defaults.

Required content:

- Profile editing.
- Account-level profile privacy.
- Account/auth controls.
- Privacy controls.

## 12. Implementation Translation Guidelines

The finished Figma designs should drive Expo structure and styling. This section describes how implementation should translate those designs, not what the designs should look like.

### Faithful Translation

- Match the user's Figma layouts, spacing, visual hierarchy, colors, typography, iconography, and interaction states as closely as Expo allows.
- Extract reusable Expo theme values only from repeated values in the user's completed designs.
- Preserve designed empty, loading, selected, disabled, private, and error states when they are provided.
- Use real album artwork and user imagery where supplied; otherwise preserve the user's placeholder treatment.
- Treat Figma measurements as the starting point, then adapt only where native safe areas, keyboard behavior, or responsive device sizes require it.

### Mobile Standards Review

Implementation may suggest focused tweaks when a design creates a concrete mobile concern:

- Tap targets smaller than 44px by 44px.
- Text contrast or text size that may fail accessibility or readability.
- Content clipped by safe areas, notches, home indicators, or the keyboard.
- Controls whose loading or disabled states cause layout shift.
- Repeated rows whose artwork, text, metadata, or actions drift out of alignment.
- Motions that should respect reduced-motion settings.
- Image handling that distorts album art or avatars.

These suggestions should be advisory. The user's design decision remains the source of truth unless the issue blocks accessibility, usability, or technical feasibility.

### Expo Implementation Approach

- Build screens using the repo's existing Expo patterns once the design handoff is complete.
- Create shared components only after at least two implemented screens prove the same visual pattern repeats.
- Keep component names semantic and product-oriented rather than tied to temporary Figma layer names.
- Keep implementation details invisible to design unless they affect the final app experience.
- Document any intentional deviations from Figma with a short reason.

## 13. States

### Empty States

Home:

- No followed users yet.
- Use the user's finished empty-state hierarchy.
- Include one short line explaining that following people fills the feed.
- Primary action: Find people.
- Secondary action: Explore albums.

Explore/Search:

- Prompt to search albums or people.
- Use a quiet centered state only before the first query.
- After a query with no results, keep the search field active and show practical next steps.

Listen Later:

- No saved albums yet.
- Use the user's final saved-albums empty-state treatment.
- Primary action: Explore albums.
- Body copy should frame the list as a future listening queue.

Profile:

- No ratings yet.
- For the current user, primary action is Rate your first album.
- For another user, use neutral copy such as `No ratings yet`.

Empty-state rules:

- Empty states should not feel like marketing panels.
- Use one clear headline, one useful supporting line, and at most two actions unless the user's final design specifies otherwise.
- Do not use illustrations unless they are simple and systemized.
- Keep empty states positioned within the available content area and clear of navigation, safe areas, and persistent controls.

### Loading States

- Skeleton album rows.
- Placeholder cover blocks.
- Loading state for rating submission.
- Loading state for follow/unfollow.

Loading rules:

- Skeletons and placeholders should follow the user's final visual system.
- Preserve final layout dimensions while loading.
- Album artwork skeletons must remain square.
- Feed loading should show two or three skeleton items, not a full fake infinite feed.
- Submission loading should happen inside the triggering control when possible.
- Avoid blocking the whole screen for small social actions like like, follow, and listen-later.

### Error States

- Album search failed.
- Spotify API unavailable.
- Rating failed to save.
- Follow action failed.
- External music link unavailable.

Errors should be written plainly and briefly. Avoid technical language.

Error rules:

- Use the user's final type and color system for error messages and actions.
- Reserve urgent/destructive styling for urgent or destructive errors.
- Explore search errors should keep the user's query visible.
- Save/rating errors should offer Retry and preserve the user's selected rating and note.
- External-link errors should not imply the album is unavailable in alby.

### Selected, Disabled, and Private States

Selected:

- Follow the user's final selected-state styling.
- Selected states need shape, weight, copy, or icon changes in addition to color.

Disabled:

- Disabled controls should visibly differ from enabled controls and should not use press animation.
- Disabled controls must still explain why they are unavailable when the reason is not obvious.

Private:

- Use the user's final privacy treatment in settings, composers, and listen-later management.
- Compact private indicators may be simplified when surrounding context is clear.
- Private state must not rely on color alone.

## 14. Data Source Direction

Spotify Web API is the MVP catalog source because it provides practical album search, cover art, artist metadata, precision-preserving release dates, and Spotify links.

Implementation direction:

- Search Spotify for full albums and four-to-six-track releases categorized by Spotify as singles (shown in Alby as EPs).
- Display at most ten fixed-US Spotify results in a temporary Explore search, with Spotify attribution on each result.
- Support Explore discovery surfaces such as new releases and recently rated by friends when data sources are finalized.
- When a user selects a result, create, reconcile, or reuse an internal Supabase album record before opening Album Detail.
- Store Spotify ID, external URL, remote cover URL, joined artist names, raw release-date precision, track count, and Album/EP release type.
- Keep Spotify Client Credentials in each Supabase project's Edge Function secrets; Spotify is not an Alby login provider.
- Additional external music service links are TBD and should not block the Spotify-first MVP.

Known tradeoffs:

- Spotify may contain duplicate album versions.
- Regional metadata may vary.
- Deluxe editions remain separate when Spotify assigns different IDs; true one-to-three-track singles and compilations are excluded for now.
- New-release sources may require a separate product decision.

This is acceptable for MVP because convenience and speed matter more than perfect canonical music metadata.

## 15. Supabase Planning Notes

### Finalized Milestone Contracts

- Authentication uses native Sign in with Apple on iOS and browser OAuth for Google through Supabase.
- First sign-in requires a unique username and editable display name.
- The app uses `com.alby.app`, the `alby` scheme, and `alby://auth/callback`.
- Protected route states are signed out, incomplete profile, and authenticated app.
- Canonical routes are `/profile`, `/users/[username]`, `/albums/[albumId]`, `/albums/[albumId]/rate`, `/edit-profile`, and `/settings`.
- The rating range is `0.5` through `5.0` in half-point increments. Users may create multiple ratings per album; the latest is current and aggregates count only that value.
- Activity events are generated from rating and Listen Later changes and feed Home, profiles, and albums.
- Listen Later creates one immutable feed event on the first save for each user and album. Unsaving preserves that event and its engagement; re-saving reconnects it without changing its timestamp or feed position.
- Rated albums cannot remain in Listen Later, and rated feed items never expose a save action.
- Rating feed activities use 96px album artwork. Listen Later feed activities use the compact 64px artwork specified in Home node `34:138`.
- Album-detail activities use the latest coverless variants from Figma: rating posts flow as a 56px header, 63px album/rating area, optional 53px note, 31px engagement row, and 32px divider; saved posts omit unavailable sections.
- Coverless Album Detail activities omit the Rate and Listen Later action row while Home and Profile activities remain actionable.
- Rating notes collapse to three lines with accessible inline Read more and Read less controls in Home, Profile, and Album Detail.
- Rating and Listen Later activity album titles open Album Detail from Home and Profile. Album Detail activity titles are plain text because the viewer is already on that album; the compact header identity remains the scroll-to-top control.
- Album metadata is presented as `Artist • Year • Track count` above the title in Album Detail and the rating composer.
- Album Detail shows a safe-area-aware 73px compact header after the hero action row scrolls past the viewport. Its album identity scrolls to the top, and Saved bookmarks use the filled icon state.
- Profile tabs use the Figma `62:51` shell: a 41px lower border with 48px corners, aligned 23px label stacks inside 25px tab content, 16px bottom space, 33px gaps, and an underline matching the active label. The side strokes overscan phone viewports by 2px per edge.
- Flexible screen content fills portrait iPhones with the established 24px side padding, then remains centered at a 600px readable-width cap on tablets and landscape. Fixed-format artwork, avatars, discs, icon controls, and modal dimensions do not stretch.
- The owner-rating carousel shown in the current Figma exploration is deferred; owner ratings remain pinned first in the vertical album feed.
- Feed timestamps use the shared muted palette color.
- Figma nodes `60:2`, `53:46`, `2016:1026`, and `2016:1138` in file `wq1ZicbFAHBAZ1xTy2Vgqp` are the visual references for User, Album Detail, Rating Composer, and the already-rated Album state.

Implemented tables:

- `profiles`
- `albums`
- `ratings`
- `listen_later_items`
- `follows`
- `activity_events`
- `likes`
- `comments`

RLS is enforced around:

- Users can manage their own ratings.
- Users can manage their own listen-later items.
- Account privacy and mutual-follow access use one shared database rule.
- Album catalog writes remain service-role operations.
- Feed and engagement queries inherit the activity author's privacy.

## 16. Design Handoff

The user will design the main screens, palette, and visual system in Figma. Codex should not create new Figma pages, generate screens, or establish a design system unless explicitly asked after the user's designs are finished.

Future design-to-Expo handoff process:

1. Inspect the user's completed Figma designs and confirm which screens are ready for implementation.
2. Extract colors, typography, spacing, imagery, icons, states, and layout measurements from Figma.
3. Map those values into Expo theme tokens and screen/component code using the repo's existing patterns.
4. Suggest small mobile-standard tweaks only when they improve accessibility, usability, native behavior, or technical feasibility.
5. Implement the approved design faithfully and document any intentional deviations.

## 17. Open Questions

- Should ratings allow a 0-point "logged but unrated" state?
- Should users be able to comment on ratings in MVP, or should MVP only support likes?
- Should album pages show all followed-user notes or only recent/top notes?
- Should additional external music services be supported after Spotify?

## 18. Current Decisions

For the first working design iteration, assume:

- Albums are the only rated media type.
- Ratings use half-point precision.
- Notes are optional.
- The social model is follower/following.
- Profiles are public by default and may be private at the account level.
- Private profile content is visible to owners and mutual follows only.
- Friend Rating uses mutual follows; Global Rating uses public-profile ratings only.
- Spotify is the MVP catalog source.
- Spotify is the first committed external album destination.
- Explore includes search for albums and artists, plus provisional new releases and recently rated by friends.
- The Figma file is the design authority; Phosphor icons are imported directly and the rating disc remains the custom visual asset.
- Expo implementation should translate those finished designs faithfully and suggest only standards-based refinements.
