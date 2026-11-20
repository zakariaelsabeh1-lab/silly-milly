# Setting up the Family Board and Silly Milly

This takes about 30 to 45 minutes the first time. You need a computer for parts 1 to 3 and the tablet for part 4.

What it costs:

| Thing | Cost |
|---|---|
| Vercel (hosts the app) | Free (Hobby plan) |
| Upstash Redis (saves the calendar and bedtime history) | Free tier |
| Open-Meteo (weather and air quality) | Free, no account |
| Anthropic API (Claude, Silly Milly's brain) | Pay as you go. Well under a cent per question with Claude Haiku 5.5. See "Keeping Claude costs down" at the end. |
| Picovoice (the "Hey Silly Milly" wake word) | Optional. Free plan for personal use. |

---

## Part 1. Get your Claude API key

1. Go to https://console.anthropic.com and sign in (or sign up).
2. Go to **Billing** and add a small amount of credit (for example $10).
3. Go to **API keys**, click **Create key**, name it `silly-milly`, and copy it. It starts with `sk-ant-`.
4. Keep it somewhere safe for Part 2. Don't paste it into chats or emails.

## Part 2. Put the app online with Vercel

1. Go to https://vercel.com and **sign up with GitHub** (use the same GitHub account that has the `silly-milly` repository).
2. Click **Add New… → Project**, find `silly-milly` in the list and click **Import**.
3. Leave the settings as they are. Open **Environment Variables** and add two:
   - `ANTHROPIC_API_KEY` = the key from Part 1
   - `FAMILY_PIN` = a number you'll type on the tablet once, e.g. `4821`. This stops strangers who find the web address from using it.
4. Click **Deploy**. Wait for the confetti. You now have an address like `https://silly-milly-xxxx.vercel.app`.

### Add the storage (one time)

1. In your Vercel project, open the **Storage** tab.
2. Click **Create Database** (or **Browse Marketplace**), pick **Upstash** → **Upstash for Redis**, choose the **Free** plan, and pick a region close to you (e.g. *us-west*).
3. When it asks which project to connect, choose `silly-milly` and keep all environments ticked.
4. Go to the **Deployments** tab, click the **⋯** menu on the newest deployment and choose **Redeploy**. (This lets the app see the new storage.)

Test it: open your `vercel.app` address on your computer. Tap the screen, type your PIN, and you should see the clock and weather. Try the Calendar tab and add a test event.

## Part 3. The "Hey Silly Milly" wake word

**It's on by default, no account or key needed.** The app uses Chrome's own speech-to-text to listen for "Hey Silly Milly".

1. Open the app on the tablet and tap the screen. When Chrome asks to use the **microphone**, tap **Allow** (pick "every time" / "while using the app" if asked).
2. Look for a small **green dot** on the yellow Milly button. That means she's listening. **⚙️ Settings** also says *Listening for "Hey Silly Milly"*.
3. Say "Hey Silly Milly", wait for the little chime, then ask. Or say it all in one go: "Hey Silly Milly, what's the weather tomorrow?"

If there's no green dot: in Chrome, open the site's settings (lock icon, or ⋮ → Settings → Site settings → Microphone) and set it to **Allow**, then tap **Reload app** in Settings.

Good to know about the built-in listening:
- Chrome sends what the microphone hears to Google's speech service while it listens, so it needs Wi-Fi.
- Chrome may make a short beep each time it restarts listening, and the microphone indicator stays on.
- It uses more battery, so keep the tablet plugged in.
- It only listens while the app is on screen, and it sleeps from 9:30 PM to 6 AM. Tap Milly any time.
- It's less exact than a dedicated wake word: it may miss a mumble, or now and then wake on something that sounds close.
- Don't want it? Settings → How to listen → **Off**, and use the Milly button.

**Optional upgrade: Picovoice.** Picovoice listens on the tablet itself (nothing sent while waiting, no beeps). Their free signup can sit "in review" for a while; once approved:
1. At https://console.picovoice.ai, your **AccessKey** is on the **Home** page (also under **Account**) with a copy button. If you see "request in review" instead, Picovoice hasn't approved the account yet and there's no key to copy; the built-in listening works meanwhile.
2. Go to **Porcupine**, type `Hey Silly Milly`, language **English**, **Train**, choose **Web (WASM)**, download and unzip to get the `.ppn` file. Get it onto the tablet.
3. In the app's **⚙️ Settings**, paste the AccessKey, choose the `.ppn` file, tap **Save**. With "How to listen" on Automatic, it switches to Picovoice by itself. If she wakes by accident, lower the sensitivity.

## Part 4. Set up the tablet

**Use Chrome, not Fully Kiosk.** The app needs Chrome's speech-to-text for Silly Milly. Fully Kiosk's built-in browser can't do that.

1. **Update Chrome**: open the Play Store, search Chrome, tap **Update** if offered. Also update **Speech Services by Google**.
2. Open Chrome and go to your `vercel.app` address.
3. Tap Chrome's **⋮** menu → **Add to Home screen** (or **Install app**) → **Install**. A "Family" icon appears on the home screen. Always open the app from this icon: it runs full screen with no address bar.
4. Open the Family icon, tap the screen, enter your PIN. When Chrome asks to use the **microphone**, tap **Allow** (choose "every time" or "while using the app" if asked).
5. Tap **Milly** and ask "What's the weather tomorrow?" to test.

### Keep it on the wall, awake and locked to the app

- **Never sleep**: Android **Settings → Display → Screen timeout** → set the longest option. The app also asks Chrome to keep the screen on while it's open. If your tablet has **Developer options**, turn on **Stay awake** (screen stays on while charging): Settings → About tablet → tap **Build number** 7 times, then Settings → System → Developer options → **Stay awake**.
- **Lock the kids into the app**: Settings → Security → **App pinning** (sometimes called *Pin windows* or *Screen pinning*) → turn on. Open the Family app, open Recent apps, tap the app icon at the top of its card → **Pin**. To unpin, hold **Back** and **Overview** together.
- **Volume**: turn media volume up so Milly is loud enough across the room.
- **Plug it in** permanently. A short right-angle USB cable looks tidiest on the wall.
- **Battery**: some cheap tablets swell if they sit at 100% for months. If the tablet has a "Protect battery" or "Charge to 85%" option, turn it on.
- **Night mode**: from 9:30 PM to 6 AM the screen dims to a dark clock after 5 minutes without a touch. Tap it to wake.

## Daily use

- **Bedtime**: at 7:30 PM the screen switches to the bedtime checklist and Milly announces it. At 7:45 she says what each child still has to do. At 8:00 she calls stories. When a list is finished, there's a celebration. **History** shows the last 14 days, with Noah's puffer in its own highlighted column. You can also ask: "Hey Silly Milly, did Noah do his puffer last night?"
- **Calendar**: tap a day to see it, **+ Add event** to add one, tap an event to edit or delete it. Or by voice: "Hey Silly Milly, add Didi's dentist appointment next Tuesday at 3:30." Repeating events (weekly swimming, yearly birthdays) are supported.
- **Questions**: anything you'd ask Alexa: weather, air quality, sports scores, homework help, jokes, stories.
- If nobody touches the screen for 3 minutes, it goes back to the home screen (or the bedtime screen during bedtime).

## Changing things later

Names, bedtime times and tasks are at the top of `public/app.js` in the `CONFIG` block. Edit them on GitHub (open the file, click the pencil, change, **Commit changes**). Vercel redeploys automatically in about a minute; reload the app on the tablet (⚙️ Settings → Reload app).

## Keeping Claude costs down

Silly Milly uses Claude Haiku 5.5, Anthropic's fast, low-cost model. A typical question costs well under a cent. Web searches cost about 1 cent each, plus a little extra for the search results Milly reads. If you ever want a smarter (but roughly 40× pricier) brain, add an environment variable in Vercel: `MILLY_MODEL` = `claude-opus-5-5`, then redeploy. You can also set a monthly spending limit at https://console.anthropic.com under **Limits**.

## If something isn't working

| Problem | Fix |
|---|---|
| "Storage isn't connected yet" | Do *Add the storage* in Part 2, then redeploy. |
| "Add a FAMILY_PIN…" | Add the `FAMILY_PIN` variable in Vercel → Settings → Environment Variables, then redeploy. |
| Milly says her Claude key is missing or not working | Check `ANTHROPIC_API_KEY` in Vercel and that your Anthropic account has credit. Redeploy after changing it. |
| Milly button shows a typing box instead of listening | You're not in Chrome, or Chrome is out of date. Open the app from the Family icon made by Chrome. |
| "I need microphone permission" | Chrome ⋮ → Settings → Site settings → Microphone → allow your vercel.app address. |
| Wake word doesn't start | ⚙️ Settings shows the reason. Check the AccessKey, that the `.ppn` was made for **Web (WASM)**, and that the phrase was trained in English. |
| Weather says "unavailable" | Check the tablet's Wi-Fi. |
| Screen turns off | See "Keep it on the wall" above. |
