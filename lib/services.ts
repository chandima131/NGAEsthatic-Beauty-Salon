export type Treatment = {
  name: string;
  price: number;
  durationMinutes: number;
  description?: string;
};

export type Category = {
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  image: string;
  alt: string;
  note?: string;
  treatments: Treatment[];
};

export const categories: Category[] = [
  {
    slug: 'aesthetic-treatments',
    name: 'Aesthetic Treatments',
    subtitle: 'Professional care, tailored to you',
    description:
      'Explore our consultation-led aesthetic treatments and choose the option that best suits your goals.',
    image: 'facial',
    alt: 'Illustrative photograph of an aesthetic skin treatment',
    note:
      'Microneedling includes a facial, steam and mask. Luxury Microneedling is a 1 hour 20 minute session with a head and shoulder massage, facial and steam.',
    treatments: [
      { name: 'Anti-Wrinkle Injection - 1 Area', price: 90, durationMinutes: 30 },
      { name: 'Anti-Wrinkle Injection - 2 Areas', price: 150, durationMinutes: 30 },
      { name: 'Anti-Wrinkle Injection - 3 Areas', price: 200, durationMinutes: 45 },
      { name: 'Vitamin B12 Injection', price: 25, durationMinutes: 15 },
      { name: 'Skin Booster', price: 100, durationMinutes: 45 },
      { name: 'Profhilo - 1 Session', price: 150, durationMinutes: 45 },
      { name: 'Profhilo - 2 Sessions', price: 250, durationMinutes: 45 },
      { name: 'Profhilo - 3 Sessions', price: 350, durationMinutes: 45 },
      { name: 'Mesotherapy', price: 60, durationMinutes: 60 },
      { name: 'Microneedling', price: 70, durationMinutes: 75 },
      { name: 'Luxury Microneedling', price: 100, durationMinutes: 80 },
    ],
  },
  {
    slug: 'facials',
    name: 'Facial Treatments',
    subtitle: 'Fresh, polished, glowing skin',
    description:
      'Choose from focused skin treatments and relaxing facials designed to leave your complexion refreshed.',
    image: 'facial',
    alt: 'Illustrative photograph of a relaxing facial treatment',
    note:
      'All facial treatments include double cleansing, instant peel, massage, steam, blackhead removal, a mask, glow serum and SPF 50.',
    treatments: [
      { name: 'Hydra Facial', price: 70, durationMinutes: 60 },
      { name: 'Hydra Facial - Course of 3', price: 180, durationMinutes: 60 },
      { name: 'Microdermabrasion', price: 50, durationMinutes: 60 },
      { name: 'Gold Facial', price: 45, durationMinutes: 60 },
      { name: 'Dermaplaning Facial', price: 45, durationMinutes: 60 },
      { name: 'Basic Facial', price: 30, durationMinutes: 45 },
      { name: 'Skin Polish', price: 8, durationMinutes: 15 },
    ],
  },
  {
    slug: 'waxing',
    name: 'Waxing',
    subtitle: 'Smooth, carefully finished results',
    description:
      'A complete menu of face and body waxing treatments, from quick finishing touches to a full body appointment.',
    image: 'hero-beauty-salon',
    alt: 'Illustrative clean private beauty treatment room',
    treatments: [
      { name: 'Full Body Waxing (Bikini Not Included)', price: 50, durationMinutes: 120 },
      { name: 'Full Legs Wax', price: 25, durationMinutes: 60 },
      { name: 'Half Legs Wax', price: 15, durationMinutes: 45 },
      { name: 'Full Arms Wax', price: 15, durationMinutes: 45 },
      { name: 'Half Arms Wax', price: 10, durationMinutes: 30 },
      { name: 'Underarm Wax', price: 6, durationMinutes: 15 },
      { name: 'Full Face Wax', price: 20, durationMinutes: 45 },
      { name: 'Eyebrow Wax', price: 7, durationMinutes: 15 },
      { name: 'Side of Face Wax', price: 6, durationMinutes: 15 },
      { name: 'Neck Wax', price: 5, durationMinutes: 15 },
      { name: 'Upper Lip Wax', price: 3, durationMinutes: 15 },
      { name: 'Chin Wax', price: 3, durationMinutes: 15 },
      { name: 'Forehead Wax', price: 3, durationMinutes: 15 },
    ],
  },
  {
    slug: 'tint',
    name: 'Tint',
    subtitle: 'Defined brows and lashes',
    description:
      'Enhance your brows and lashes with polished tinting treatments for a naturally defined finish.',
    image: 'makeup',
    alt: 'Illustrative beauty portrait with defined brows and lashes',
    treatments: [
      { name: 'Eyebrow Tint', price: 7, durationMinutes: 15 },
      { name: 'Eyelash Tint', price: 7, durationMinutes: 30 },
      { name: 'Eyebrow & Lash Tint', price: 13, durationMinutes: 30 },
      { name: 'High Definition Brows', price: 20, durationMinutes: 60 },
    ],
  },
  {
    slug: 'threading',
    name: 'Threading',
    subtitle: 'Clean lines and precise shaping',
    description:
      'Precise facial threading for tidy brows, smooth skin and beautifully finished facial contours.',
    image: 'makeup',
    alt: 'Illustrative portrait showing detailed brow styling',
    treatments: [
      { name: 'Full Face Threading including Brows', price: 20, durationMinutes: 45 },
      { name: 'Eyebrow Threading', price: 6, durationMinutes: 15 },
      { name: 'Upper Lip Threading', price: 3, durationMinutes: 15 },
      { name: 'Chin Threading', price: 3, durationMinutes: 15 },
      { name: 'Forehead Threading', price: 3, durationMinutes: 15 },
    ],
  },
  {
    slug: 'lashes',
    name: 'Lashes',
    subtitle: 'Lifted, glossy, effortless lashes',
    description:
      'Low-maintenance lash treatments that enhance your natural lashes with lift and definition.',
    image: 'makeup',
    alt: 'Illustrative beauty portrait with lifted lashes',
    treatments: [
      { name: 'Lash Lamination', price: 20, durationMinutes: 45 },
      { name: 'Lash Lift & Tint', price: 25, durationMinutes: 60 },
    ],
  },
  {
    slug: 'makeup',
    name: 'Makeup',
    subtitle: 'A polished look for your occasion',
    description:
      'Professional party makeup with lashes for a confident, photo-ready finish.',
    image: 'makeup',
    alt: 'Illustrative elegant party makeup portrait',
    treatments: [
      { name: 'Party Makeup with Lashes', price: 45, durationMinutes: 75 },
    ],
  },
];

export const treatments = categories.flatMap((category) =>
  category.treatments.map((treatment) => ({ ...treatment, category: category.name })),
);

export const priceDisclaimer =
  'Treatment availability and prices may change. Please contact NG Aesthetics & Beauty Lab to confirm your appointment and treatment.';
