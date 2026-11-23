// Sample data only. Restarting the server restores these stock quantities.
const sampleProducts = [
  {
    product_id: "P1001",
    name: "Wireless Headphones",
    price: 2999,
    quantity: 12,
    category: "Audio",
    description:
      "A little less noise. A lot more music. Comfortable over-ear headphones for your daily soundtrack, focused work, and slow weekends.",
    summary: "Your everyday escape, without the wires.",
    image: "/images/headphones.jpg",
    features: [
      "Wireless Bluetooth connection",
      "Soft, cushioned ear cups",
      "Rechargeable battery",
    ],
  },
  {
    product_id: "P1002",
    name: "Mechanical Keyboard",
    price: 4499,
    quantity: 8,
    category: "Workspace",
    description:
      "Make every keystroke a little more satisfying. A compact mechanical keyboard with tactile keys and a considered layout for a comfortable desk setup.",
    summary: "A better feel for everything you type.",
    image: "/images/keyboard.jpg",
    features: [
      "Tactile mechanical switches",
      "Compact desk-friendly layout",
      "USB connection",
    ],
  },
  {
    product_id: "P1003",
    name: "USB-C Hub",
    price: 1999,
    quantity: 20,
    category: "Accessories",
    description:
      "One small addition, more ways to connect. This lightweight hub brings your everyday accessories together and keeps your workspace simple.",
    summary: "Small in size. Big on possibilities.",
    image: "/images/hub.jpg",
    features: [
      "Multiple USB ports",
      "Compact aluminum body",
      "Plug-and-play setup",
    ],
  },
  {
    product_id: "P1004",
    name: "Ergonomic Mouse",
    price: 2499,
    quantity: 15,
    category: "Workspace",
    description:
      "Comfort that keeps up with your day. A thoughtfully shaped wireless mouse for smooth navigation, everyday work, and a more relaxed grip.",
    summary: "Less effort. A more comfortable workday.",
    image: "/images/mouse.jpg",
    features: [
      "Comfortable contoured shape",
      "Wireless connection",
      "Precise optical tracking",
    ],
  },
];

module.exports = { sampleProducts };
