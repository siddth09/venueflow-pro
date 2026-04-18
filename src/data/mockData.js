export default {
  "event": {
    "id": "evt_001",
    "name": "Mumbai Indians vs Chennai Super Kings",
    "shortName": "MI vs CSK",
    "venue": "Wankhede Stadium",
    "date": "2026-04-18",
    "kickoffOffset": 1800000,
    "totalDurationMs": 14400000
  },
  "stadium": {
    "name": "Wankhede Stadium",
    "totalCapacity": 33000,
    "sections": [
      { "id": "north", "label": "North Stand", "capacity": 5000, "density": 0.82, "gates": ["Gate A"] },
      { "id": "south", "label": "South Stand", "capacity": 5000, "density": 0.65, "gates": ["Gate D"] },
      { "id": "east",  "label": "East Wing",   "capacity": 6000, "density": 0.91, "gates": ["Gate B"] },
      { "id": "west",  "label": "West Wing",   "capacity": 6000, "density": 0.55, "gates": ["Gate C"] },
      { "id": "vip",   "label": "VIP Pavilion","capacity": 3000, "density": 0.40, "gates": ["VIP Entry"] },
      { "id": "upper_north", "label": "Upper North", "capacity": 4000, "density": 0.70, "gates": ["Gate A2"] },
      { "id": "upper_south", "label": "Upper South", "capacity": 4000, "density": 0.60, "gates": ["Gate D2"] }
    ],
    "facilities": {
      "restrooms": [
        { "id": "wc_n1", "label": "Restroom — North L1", "section": "north", "waitTime": 8, "accessible": true },
        { "id": "wc_s1", "label": "Restroom — South L1", "section": "south", "waitTime": 4, "accessible": true },
        { "id": "wc_e1", "label": "Restroom — East L1",  "section": "east",  "waitTime": 12, "accessible": false },
        { "id": "wc_w1", "label": "Restroom — West L2",  "section": "west",  "waitTime": 3, "accessible": true }
      ],
      "concessions": [
        { "id": "food_n1", "label": "Food Court North",    "section": "north", "waitTime": 10, "open": true },
        { "id": "food_e1", "label": "East Refreshments",   "section": "east",  "waitTime": 6,  "open": true },
        { "id": "food_vip","label": "VIP Lounge Kitchen",  "section": "vip",   "waitTime": 2,  "open": true },
        { "id": "food_w1", "label": "West Snack Bar",      "section": "west",  "waitTime": 4,  "open": true }
      ],
      "gates": [
        { "id": "gate_a", "label": "Gate A",    "waitTime": 5, "open": true },
        { "id": "gate_b", "label": "Gate B",    "waitTime": 12,"open": true },
        { "id": "gate_c", "label": "Gate C",    "waitTime": 3, "open": true },
        { "id": "gate_d", "label": "Gate D",    "waitTime": 7, "open": true },
        { "id": "gate_vip","label": "VIP Entry","waitTime": 1, "open": true }
      ]
    }
  },
  "menu": {
    "categories": [
      {
        "id": "burgers", "label": "Burgers", "icon": "🍔",
        "items": [
          { "id": "b1", "name": "Classic Cheeseburger",    "price": 280, "prepTime": 8,  "popular": true,  "veg": false, "calories": 540 },
          { "id": "b2", "name": "Veggie Whopper",          "price": 250, "prepTime": 7,  "popular": false, "veg": true,  "calories": 480 },
          { "id": "b3", "name": "Spicy Paneer Burger",     "price": 240, "prepTime": 8,  "popular": true,  "veg": true,  "calories": 450 }
        ]
      },
      {
        "id": "pizza", "label": "Pizza", "icon": "🍕",
        "items": [
          { "id": "p1", "name": "Margherita Pizza",        "price": 320, "prepTime": 12, "popular": false, "veg": true,  "calories": 620 },
          { "id": "p2", "name": "Pepperoni Slice",         "price": 180, "prepTime": 6,  "popular": true,  "veg": false, "calories": 380 },
          { "id": "p3", "name": "Paneer Tikka Pizza",      "price": 340, "prepTime": 13, "popular": true,  "veg": true,  "calories": 580 }
        ]
      },
      {
        "id": "snacks", "label": "Snacks", "icon": "🍟",
        "items": [
          { "id": "s1", "name": "French Fries (Large)",    "price": 160, "prepTime": 5,  "popular": true,  "veg": true,  "calories": 380 },
          { "id": "s2", "name": "Nachos with Salsa",       "price": 180, "prepTime": 5,  "popular": false, "veg": true,  "calories": 420 },
          { "id": "s3", "name": "Pani Puri (6 pcs)",       "price": 120, "prepTime": 3,  "popular": true,  "veg": true,  "calories": 200 }
        ]
      },
      {
        "id": "drinks", "label": "Drinks", "icon": "🥤",
        "items": [
          { "id": "d1", "name": "Cold Coca-Cola",          "price": 80,  "prepTime": 1,  "popular": true,  "veg": true,  "calories": 140 },
          { "id": "d2", "name": "Fresh Lime Soda",         "price": 70,  "prepTime": 2,  "popular": false, "veg": true,  "calories": 60  },
          { "id": "d3", "name": "Mango Lassi",             "price": 100, "prepTime": 3,  "popular": true,  "veg": true,  "calories": 220 }
        ]
      }
    ]
  },
  "staff": [
    { "id": "st1", "name": "Raj Kumar",   "role": "Gate Marshal",    "zone": "north", "status": "active" },
    { "id": "st2", "name": "Priya Singh", "role": "Concession Lead", "zone": "east",  "status": "active" },
    { "id": "st3", "name": "Amit Sharma", "role": "Medical",         "zone": "vip",   "status": "standby" },
    { "id": "st4", "name": "Neha Rao",    "role": "Security",        "zone": "south", "status": "active" }
  ]
};
