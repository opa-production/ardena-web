// Newsroom preview data. Only used when the page runs in mock mode
// (localhost, *.vercel.app previews, or ?mock=1). See newsroom.js.
(function () {
  "use strict";

  function img(id) {
    return {
      id: id,
      url: "https://images.unsplash.com/photo-" + id + "?auto=format&fit=crop&w=1600&q=80",
      thumb: "https://images.unsplash.com/photo-" + id + "?auto=format&fit=crop&w=480&q=70",
      photographer_name: "Unsplash",
      photographer_url: "https://unsplash.com",
      unsplash_url: "https://unsplash.com",
    };
  }

  // Photos the mock image picker can search. Tags drive the fake search.
  var LIBRARY = [
    ["1449965408869-eaa3f722e40d", "Driver's hands on the wheel at dusk", "car driving road wheel night city"],
    ["1460925895917-afdab827c52f", "Laptop showing analytics charts", "laptop data analytics pricing work office"],
    ["1469854523086-cc02fe5d8800", "Van on an open desert road", "road trip travel van desert"],
    ["1476514525535-07fb3b4ae5f1", "Boat on a mountain lake", "travel lake water nature"],
    ["1485291571150-772bcfc10da5", "Dark sedan in studio light", "car sedan black luxury"],
    ["1486406146926-c627a92ad1ab", "Glass office towers from below", "city building office company"],
    ["1489392191049-fc10c97e64b6", "Mount Kilimanjaro above the savanna", "kenya africa savanna mountain landscape"],
    ["1489824904134-891ab64532f1", "Orange classic Beetle parked outside", "car classic orange street"],
    ["1494976388531-d1058494cdd8", "Grey muscle car in a car park", "car grey parking"],
    ["1500530855697-b586d89ba3ee", "Empty road through red canyons", "road trip travel landscape"],
    ["1502877338535-766e1452684a", "Blue coupe parked on the street", "car blue street"],
    ["1516026672322-bc52d61a55d5", "Acacia tree at sunset", "kenya africa acacia sunset savanna"],
    ["1516426122078-c23e76319801", "Safari vehicle at sunrise", "kenya safari africa car sunrise"],
    ["1517048676732-d65bc937f952", "Team meeting around a table", "team meeting office work people"],
    ["1519003722824-194d4455a60c", "Lorry on a mountain highway", "road highway travel"],
    ["1521737604893-d14cc237f11d", "Team working together at a long table", "team office people work"],
    ["1522071820081-009f0129c71c", "Colleagues collaborating on laptops", "team people laptop work startup"],
    ["1523805009345-7448845a9e53", "Giraffe under an acacia at dusk", "kenya africa wildlife giraffe safari"],
    ["1531545514256-b1400bc00f31", "Group smiling around a laptop", "team people laptop community"],
    ["1533473359331-0135ef1b58bf", "White SUV on a desert track", "car suv road travel"],
    ["1535941339077-2dd1c7963098", "Elephant on the plains", "kenya africa wildlife elephant safari"],
    ["1541899481282-d53bffe3c35d", "Blue hatchback parked outside", "car hatchback blue host"],
    ["1547471080-7cc2caa01a7e", "Sunset over the savanna", "kenya africa sunset savanna"],
    ["1551836022-d5d88e9218df", "Two women in a work meeting", "people meeting work office"],
    ["1556656793-08538906a9f8", "Phones laid out on a desk", "phone app mobile product"],
    ["1556761175-5973dc0f32e7", "Bright open plan office", "office team work company"],
    ["1568605117036-5fe5e7bab0b7", "Car on a winding road at golden hour", "car road trip travel sunset"],
    ["1580273916550-e323be2ae537", "Grey sports saloon on a coastal road", "car road grey"],
    ["1600880292203-757bb62b4baf", "Colleagues high fiving at work", "team people celebrate referral"],
    ["1611348586804-61bf6c080437", "Woman working with headphones on", "people work focus"],
  ].map(function (row) {
    var p = img(row[0]);
    p.alt = row[1];
    p.tags = row[2];
    return p;
  });

  function byId(id) {
    for (var i = 0; i < LIBRARY.length; i++) if (LIBRARY[i].id === id) return LIBRARY[i];
    return img(id);
  }

  function figure(id, caption) {
    var p = byId(id);
    return '<figure><img src="' + p.url + '" alt="' + p.alt + '"><figcaption>' + (caption || p.alt) + ". Photo: Unsplash</figcaption></figure>";
  }

  var STORIES = [
    {
      slug: "ardena-is-live-in-nakuru",
      category: "Company",
      title: "Ardena is live in Nakuru, and this is only the start",
      excerpt: "Verified cars from local owners, booked in minutes. Here is what we built, why we started in Nakuru, and where we go next.",
      cover: "1489392191049-fc10c97e64b6",
      author: "Ardena Newsroom",
      published_at: "2026-09-18",
      featured: true,
      body:
        "<p>Today Ardena is live in Nakuru. Anyone with a valid licence can now book a verified car from a local owner, pay securely, and pick it up without the paperwork that usually comes with renting a car in Kenya.</p>" +
        "<p>We started with a simple observation. Thousands of good cars sit parked for most of the week, while people who need a car for a weekend, a wedding or a work trip struggle to find one they can trust. Ardena connects the two, with verification and protection built in from the first tap.</p>" +
        "<h2>Why Nakuru first</h2>" +
        "<p>Nakuru is growing fast, sits at the heart of some of the best drives in the country, and has a community of car owners who told us early that they wanted a better way to earn from their vehicles. Launching in one city lets us get the details right before we grow.</p>" +
        figure("1516026672322-bc52d61a55d5", "The Rift Valley is on Nakuru's doorstep") +
        "<h2>What you get on day one</h2>" +
        "<ul><li>Verified renters and verified hosts, checked before any booking is confirmed.</li><li>Clear pricing with no surprises at pickup.</li><li>Protection options for every trip.</li><li>Support from a team that picks up the phone.</li></ul>" +
        "<blockquote>We want renting a car from a neighbour to feel as safe as renting from a counter at the airport, and a lot more personal.</blockquote>" +
        "<h2>What comes next</h2>" +
        "<p>We are rolling out across Kenya, city by city. Nairobi, Mombasa and Kisumu are next on the list, and we will share dates here as each one gets closer. If you own a car in any of those cities, you can register your interest as a host today.</p>",
    },
    {
      slug: "what-our-first-hosts-taught-us",
      category: "Hosts",
      title: "What our first hosts taught us about trust",
      excerpt: "Before we opened bookings, we sat down with the owners who would list first. Their questions shaped the product.",
      cover: "1541899481282-d53bffe3c35d",
      author: "Ardena Host Team",
      published_at: "2026-09-10",
      body:
        "<p>Handing your car keys to a stranger is a big ask. Before we opened bookings in Nakuru, we spent weeks with the owners who would be the first to list, and asked them one question: what would make you comfortable?</p>" +
        "<h2>Know who is driving</h2>" +
        "<p>Every host said the same thing first. They wanted to know the person behind the booking. That is why every renter on Ardena completes identity checks before they can book, and why hosts can see a verified profile before they accept.</p>" +
        "<h2>Get paid without chasing</h2>" +
        "<p>The second theme was money. Hosts did not want to collect cash or chase late payments. Renters pay upfront through the app, and payouts go straight to the host after the trip.</p>" +
        "<blockquote>I was nervous about the first booking. After that one went smoothly, I stopped worrying and started planning which weekends to keep the car free.</blockquote>" +
        "<h2>Stay in control</h2>" +
        "<p>Finally, hosts wanted control over when and how their car is used. They set their own availability, their own price, and their own pickup instructions. We handle the rest.</p>",
    },
    {
      slug: "how-we-verify-every-renter",
      category: "Safety",
      title: "How we verify every renter before they drive",
      excerpt: "Identity, licence and a live selfie. A plain look at the checks that happen before any keys change hands.",
      cover: "1449965408869-eaa3f722e40d",
      author: "Ardena Trust and Safety",
      published_at: "2026-09-02",
      body:
        "<p>Safety on Ardena starts long before pickup. Every renter goes through the same verification steps, and no booking is confirmed until they pass.</p>" +
        "<h2>The three checks</h2>" +
        "<ol><li><strong>Identity.</strong> We confirm the renter's national ID or passport with our verification partner.</li><li><strong>Driving licence.</strong> We check that the licence is valid and matches the person booking.</li><li><strong>Live selfie.</strong> A quick selfie confirms the person holding the phone is the person on the documents.</li></ol>" +
        "<p>Most renters finish all three in a few minutes. If something does not match, our team reviews it by hand.</p>" +
        figure("1568605117036-5fe5e7bab0b7", "Verification happens once, then every trip is quicker") +
        "<h2>Why it matters for hosts</h2>" +
        "<p>Hosts see a verified badge on every request. They know the person arriving at pickup has been checked, and that the booking is tied to a real identity.</p>" +
        "<h2>Your data</h2>" +
        "<p>We collect only what verification needs, store it securely, and never sell it. You can read the full details in our privacy policy.</p>",
    },
    {
      slug: "a-faster-way-to-book",
      category: "Product",
      title: "A faster way to book: what is new in the Ardena app",
      excerpt: "Fewer taps from search to keys, saved favourites, and trip details you can share with one link.",
      cover: "1556656793-08538906a9f8",
      author: "Ardena Product",
      published_at: "2026-08-26",
      body:
        "<p>The latest version of the Ardena app is rolling out now on iOS and Android. It is built around one goal: get you from search to keys with as little friction as possible.</p>" +
        "<h2>What changed</h2>" +
        "<ul><li><strong>Faster checkout.</strong> Your verified details and payment method carry over, so repeat bookings take seconds.</li><li><strong>Favourites.</strong> Save cars you like and get a nudge when they are free on your dates.</li><li><strong>Shareable trips.</strong> Send your pickup time and location to a friend or family member with one link.</li></ul>" +
        "<h2>For hosts</h2>" +
        "<p>The host app now shows upcoming trips on a single calendar, with earnings for the month at the top. Accepting a request takes one tap.</p>" +
        "<p>Update from the App Store or Google Play to get the new version.</p>",
    },
    {
      slug: "weekend-drives-from-nakuru",
      category: "Travel",
      title: "Five weekend drives from Nakuru worth the fuel",
      excerpt: "Crater rims, flamingo lakes and hot springs, all within easy reach for a Saturday.",
      cover: "1516426122078-c23e76319801",
      author: "Ardena Newsroom",
      published_at: "2026-08-19",
      body:
        "<p>One of the best things about living in Nakuru is how much is within a short drive. Here are five of our favourite trips for a free weekend.</p>" +
        "<h2>1. Menengai Crater</h2>" +
        "<p>Start close to home. The drive up to the crater rim is short, and the view across the caldera is one of the largest of its kind anywhere.</p>" +
        "<h2>2. Lake Elementaita</h2>" +
        "<p>A calm soda lake with flamingos, good lodges and a quiet shoreline. Perfect for a slow Sunday.</p>" +
        "<h2>3. Lake Naivasha and Hell's Gate</h2>" +
        "<p>Take the boat out on Naivasha in the morning, then cycle or walk through the gorges at Hell's Gate in the afternoon.</p>" +
        figure("1523805009345-7448845a9e53", "Wildlife is never far from the road in the Rift Valley") +
        "<h2>4. Lake Bogoria</h2>" +
        "<p>Hot springs, geysers and, in the right season, huge flocks of flamingos. The road is good and the landscape is unlike anywhere else.</p>" +
        "<h2>5. Lake Baringo</h2>" +
        "<p>A freshwater lake with excellent birdlife and boat trips. Worth an overnight stay.</p>" +
        "<p>Pick a car that suits the road. An SUV is a comfortable choice for longer or rougher routes.</p>",
    },
    {
      slug: "refer-a-friend-earn-up-to-3500",
      category: "Community",
      title: "Refer a friend, earn up to KSh 3,500",
      excerpt: "Our referral programme rewards you for bringing new renters and hosts to Ardena. Here is how it works.",
      cover: "1600880292203-757bb62b4baf",
      author: "Ardena Newsroom",
      published_at: "2026-08-12",
      body:
        "<p>The best way to grow a community built on trust is through people who already trust it. That is why we are rewarding members who invite friends to Ardena.</p>" +
        "<h2>How it works</h2>" +
        "<ol><li>Share your personal code from the app.</li><li>Your friend signs up and completes their first trip, or lists their car and completes their first booking as a host.</li><li>You both get rewarded.</li></ol>" +
        "<p>You can earn up to KSh 3,500 per referral. Full terms are on our refer and earn page.</p>",
    },
    {
      slug: "inside-the-team-building-ardena",
      category: "Company",
      title: "Inside the team building Ardena",
      excerpt: "A small team with a big job. Meet the people behind the product, and see how we work.",
      cover: "1522071820081-009f0129c71c",
      author: "Ardena Newsroom",
      published_at: "2026-08-04",
      body:
        "<p>Ardena is built by a small team in Kenya that cares about getting the details right. Engineers, operators and support staff sit close together, and most decisions are made in the same room as the people they affect.</p>" +
        "<h2>How we work</h2>" +
        "<p>We ship in small steps and talk to hosts and renters every week. When something breaks, the person who built it helps fix it. When a customer calls, they get a real person.</p>" +
        figure("1517048676732-d65bc937f952", "Weekly product review") +
        "<h2>We are hiring</h2>" +
        "<p>If you want to help build trusted mobility for Kenya, take a look at our careers page.</p>",
    },
    {
      slug: "pricing-your-car-a-guide-for-hosts",
      category: "Hosts",
      title: "Pricing your car well: a short guide for hosts",
      excerpt: "The right daily rate fills your calendar without underselling your car. Four things to consider.",
      cover: "1460925895917-afdab827c52f",
      author: "Ardena Host Team",
      published_at: "2026-07-28",
      body:
        "<p>Setting a price is the most important decision a host makes. Too high and the calendar stays empty. Too low and you are leaving money on the table.</p>" +
        "<h2>1. Start with similar cars</h2><p>Look at cars like yours in your city. Match the market first, then adjust as reviews come in.</p>" +
        "<h2>2. Price weekends differently</h2><p>Demand is higher on Fridays and Saturdays. A slightly higher weekend rate is normal.</p>" +
        "<h2>3. Reward longer trips</h2><p>Weekly discounts attract renters who need a car for work or travel, and mean fewer handovers for you.</p>" +
        "<h2>4. Keep it clean</h2><p>A clean, well maintained car earns better reviews, and better reviews justify a better price.</p>",
    },
    {
      slug: "insurance-and-protection-explained",
      category: "Safety",
      title: "Insurance and protection, explained plainly",
      excerpt: "What is covered, what is not, and what to do if something goes wrong on a trip.",
      cover: "1580273916550-e323be2ae537",
      author: "Ardena Trust and Safety",
      published_at: "2026-07-21",
      body:
        "<p>Protection is one of the questions we hear most, from hosts and renters alike. Here is a plain summary.</p>" +
        "<h2>For renters</h2><p>Every trip includes a set level of protection. You can also choose an optional damage waiver at checkout to reduce what you pay if something happens.</p>" +
        "<h2>For hosts</h2><p>Your car is protected during every Ardena trip, from pickup to return. If there is damage, we guide you through the claim.</p>" +
        "<h2>If something goes wrong</h2><ol><li>Make sure everyone is safe.</li><li>Take photos of the scene and the car.</li><li>Report it in the app, or call our support line.</li></ol>" +
        "<p>Full details are on our insurance and protection page.</p>",
    },
    {
      slug: "road-trip-checklist",
      category: "Travel",
      title: "Road trip checklist: what to do before you drive off",
      excerpt: "Ten minutes at pickup saves a lot of hassle later. Our quick checklist for every trip.",
      cover: "1469854523086-cc02fe5d8800",
      author: "Ardena Newsroom",
      published_at: "2026-07-14",
      body:
        "<p>A good trip starts at pickup. Before you drive away, run through this quick list.</p>" +
        "<ul><li>Walk around the car and photograph every side in the app.</li><li>Check the fuel level and note it.</li><li>Test the lights, wipers and air conditioning.</li><li>Confirm the return time and location with your host.</li><li>Save the host's contact and our support number.</li></ul>" +
        figure("1500530855697-b586d89ba3ee", "The open road, once the checklist is done") +
        "<p>That is it. Enjoy the drive.</p>",
    },
  ];

  STORIES.forEach(function (s) {
    var c = byId(s.cover);
    s.cover_image = { url: c.url, thumb: c.thumb, alt: c.alt, photographer_name: c.photographer_name, photographer_url: c.photographer_url, unsplash_url: c.unsplash_url };
    delete s.cover;
    s.reading_minutes = Math.max(2, Math.round(s.body.replace(/<[^>]+>/g, " ").split(/\s+/).length / 200));
  });

  window.ARDENA_NEWSROOM_MOCK = { stories: STORIES, library: LIBRARY };
})();
