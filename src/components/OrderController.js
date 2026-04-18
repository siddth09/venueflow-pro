/**
 * VenueFlow Pro — Food Order Controller
 * Single Responsibility: manages in-seat food ordering, cart, and order lifecycle.
 * All DOM rendering via textContent / createElement — XSS-compliant.
 */

import mockData from '../data/mockData.json' assert { type: 'json' };

const ORDER_STAGES = ['received', 'preparing', 'on_the_way', 'delivered'];
const STAGE_LABELS  = { received: 'Order Received', preparing: 'Preparing', on_the_way: 'On the Way 🛵', delivered: 'Delivered! 🎉' };

export class OrderController {
  /**
   * @param {import('../engine/state.js').StateEngine} store
   */
  constructor(store) {
    this.store = store;
    this._menu = mockData.menu;
    this._activeCategory = this._menu.categories[0].id;
    this._activeFilter = 'all'; // all | veg | popular

    this._render();
    this.store.subscribe('user', user => this._renderCart(user.cart, user.orders));
  }

  _render() {
    this._renderCategories();
    this._renderItems();
    this._renderCart(
      this.store.getState().user.cart,
      this.store.getState().user.orders
    );

    // Filter buttons
    document.querySelectorAll('.food-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activeFilter = btn.dataset.filter;
        document.querySelectorAll('.food-filter-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.filter === this._activeFilter)
        );
        this._renderItems();
      });
    });
  }

  _renderCategories() {
    const nav = document.getElementById('category-nav');
    if (!nav) return;
    nav.innerHTML = '';

    this._menu.categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `cat-btn ${cat.id === this._activeCategory ? 'active' : ''}`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', cat.id === this._activeCategory ? 'true' : 'false');
      btn.setAttribute('aria-controls', 'food-items-grid');
      btn.setAttribute('id', `cat-tab-${cat.id}`);

      const icon = document.createElement('span');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = cat.icon;

      const label = document.createElement('span');
      label.textContent = cat.label;

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        this._activeCategory = cat.id;
        document.querySelectorAll('.cat-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        this._renderItems();
      });

      nav.appendChild(btn);
    });
  }

  _renderItems() {
    const grid = document.getElementById('food-items-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const category = this._menu.categories.find(c => c.id === this._activeCategory);
    if (!category) return;

    let items = category.items;
    if (this._activeFilter === 'veg') items = items.filter(i => i.veg);
    if (this._activeFilter === 'popular') items = items.filter(i => i.popular);

    const cart = this.store.getState().user.cart;

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'food-card';
      card.setAttribute('role', 'article');
      card.setAttribute('aria-label', `${item.name}, ₹${item.price}`);

      const header = document.createElement('div');
      header.className = 'food-card-header';

      const badges = document.createElement('div');
      badges.className = 'food-badges';
      if (item.veg) {
        const vegBadge = document.createElement('span');
        vegBadge.className = 'badge badge--veg';
        vegBadge.textContent = '🌱 Veg';
        badges.appendChild(vegBadge);
      }
      if (item.popular) {
        const popBadge = document.createElement('span');
        popBadge.className = 'badge badge--popular';
        popBadge.textContent = '🔥 Popular';
        badges.appendChild(popBadge);
      }
      header.appendChild(badges);

      const name = document.createElement('h4');
      name.className = 'food-name';
      name.textContent = item.name;

      const meta = document.createElement('div');
      meta.className = 'food-meta';

      const prep = document.createElement('span');
      prep.className = 'food-prep-time';
      prep.textContent = `⏱ ${item.prepTime} min`;

      const cal = document.createElement('span');
      cal.className = 'food-calories';
      cal.textContent = `${item.calories} kcal`;

      meta.appendChild(prep);
      meta.appendChild(cal);

      const footer = document.createElement('div');
      footer.className = 'food-card-footer';

      const price = document.createElement('span');
      price.className = 'food-price';
      price.textContent = `₹${item.price}`;

      const inCart = cart.find(ci => ci.id === item.id);
      const addBtn = document.createElement('button');
      addBtn.className = `add-to-cart-btn ${inCart ? 'in-cart' : ''}`;
      addBtn.setAttribute('aria-label', `Add ${item.name} to cart`);
      addBtn.textContent = inCart ? `In Cart (${inCart.qty})` : '+ Add';
      addBtn.addEventListener('click', () => this._addToCart(item));

      footer.appendChild(price);
      footer.appendChild(addBtn);

      card.appendChild(header);
      card.appendChild(name);
      card.appendChild(meta);
      card.appendChild(footer);
      grid.appendChild(card);
    });

    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'food-empty';
      empty.textContent = 'No items match this filter.';
      grid.appendChild(empty);
    }
  }

  _addToCart(item) {
    const currentCart = this.store.getState().user.cart;
    const existing = currentCart.find(ci => ci.id === item.id);
    let newCart;
    if (existing) {
      newCart = currentCart.map(ci => ci.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci);
    } else {
      newCart = [...currentCart, { ...item, qty: 1 }];
    }
    this.store.setState({ user: { cart: newCart } });
    this._renderItems(); // refresh badges
  }

  _removeFromCart(itemId) {
    const currentCart = this.store.getState().user.cart;
    const newCart = currentCart
      .map(ci => ci.id === itemId ? { ...ci, qty: ci.qty - 1 } : ci)
      .filter(ci => ci.qty > 0);
    this.store.setState({ user: { cart: newCart } });
  }

  _placeOrder() {
    const cart = this.store.getState().user.cart;
    if (!cart.length) return;

    const order = {
      id: `ORD-${Date.now()}`,
      items: cart,
      total: cart.reduce((sum, i) => sum + i.price * i.qty, 0),
      stage: 'received',
      placedAt: Date.now(),
      estimatedMins: Math.max(...cart.map(i => i.prepTime)) + 5,
    };

    const orders = [...this.store.getState().user.orders, order];
    this.store.setState({ user: { cart: [], orders } });

    // Simulate order progression
    this._progressOrder(order.id, orders);
  }

  _progressOrder(orderId, orders) {
    let stageIndex = 0;
    const timer = setInterval(() => {
      stageIndex++;
      if (stageIndex >= ORDER_STAGES.length) {
        clearInterval(timer);
        return;
      }
      const currentOrders = this.store.getState().user.orders;
      const updated = currentOrders.map(o =>
        o.id === orderId ? { ...o, stage: ORDER_STAGES[stageIndex] } : o
      );
      this.store.setState({ user: { orders: updated } });
    }, 15000); // advance every 15 seconds
  }

  _renderCart(cart = [], orders = []) {
    this._renderCartItems(cart);
    this._renderOrders(orders);
    this._renderCartSummary(cart);
  }

  _renderCartItems(cart) {
    const cartEl = document.getElementById('cart-items');
    if (!cartEl) return;
    cartEl.innerHTML = '';

    if (!cart.length) {
      const empty = document.createElement('p');
      empty.className = 'cart-empty';
      empty.textContent = '🛒 Your cart is empty. Add items from the menu!';
      cartEl.appendChild(empty);
      return;
    }

    cart.forEach(item => {
      const row = document.createElement('div');
      row.className = 'cart-row';

      const info = document.createElement('div');
      info.className = 'cart-row-info';

      const name = document.createElement('span');
      name.className = 'cart-item-name';
      name.textContent = item.name;

      const subprice = document.createElement('span');
      subprice.className = 'cart-item-subprice';
      subprice.textContent = `₹${item.price} × ${item.qty}`;

      info.appendChild(name);
      info.appendChild(subprice);

      const controls = document.createElement('div');
      controls.className = 'cart-controls';

      const minus = document.createElement('button');
      minus.className = 'qty-btn';
      minus.setAttribute('aria-label', `Remove one ${item.name}`);
      minus.textContent = '−';
      minus.addEventListener('click', () => this._removeFromCart(item.id));

      const qty = document.createElement('span');
      qty.className = 'cart-qty';
      qty.textContent = String(item.qty);

      const plus = document.createElement('button');
      plus.className = 'qty-btn';
      plus.setAttribute('aria-label', `Add one more ${item.name}`);
      plus.textContent = '+';
      plus.addEventListener('click', () => this._addToCart(item));

      const total = document.createElement('span');
      total.className = 'cart-item-total';
      total.textContent = `₹${item.price * item.qty}`;

      controls.appendChild(minus);
      controls.appendChild(qty);
      controls.appendChild(plus);
      controls.appendChild(total);

      row.appendChild(info);
      row.appendChild(controls);
      cartEl.appendChild(row);
    });
  }

  _renderCartSummary(cart) {
    const summaryEl = document.getElementById('cart-summary');
    const placeBtn = document.getElementById('place-order-btn');
    if (!summaryEl) return;

    const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const count = cart.reduce((sum, i) => sum + i.qty, 0);

    if (!placeBtn) return;
    if (cart.length) {
      summaryEl.textContent = `${count} item${count !== 1 ? 's' : ''} · ₹${total}`;
      placeBtn.disabled = false;
      placeBtn.onclick = () => this._placeOrder();
    } else {
      summaryEl.textContent = '';
      placeBtn.disabled = true;
    }
  }

  _renderOrders(orders) {
    const ordersEl = document.getElementById('orders-list');
    if (!ordersEl || !orders.length) return;
    ordersEl.innerHTML = '';

    [...orders].reverse().forEach(order => {
      const card = document.createElement('div');
      card.className = `order-card order-card--${order.stage}`;
      card.setAttribute('role', 'region');
      card.setAttribute('aria-label', `Order ${order.id}`);
      card.setAttribute('aria-live', 'polite');

      const header = document.createElement('div');
      header.className = 'order-header';

      const idEl = document.createElement('span');
      idEl.className = 'order-id';
      idEl.textContent = order.id;

      const totalEl = document.createElement('span');
      totalEl.className = 'order-total';
      totalEl.textContent = `₹${order.total}`;

      header.appendChild(idEl);
      header.appendChild(totalEl);

      // Progress tracker
      const progress = document.createElement('div');
      progress.className = 'order-progress';
      progress.setAttribute('role', 'progressbar');
      progress.setAttribute('aria-label', `Order status: ${STAGE_LABELS[order.stage]}`);

      ORDER_STAGES.forEach(stage => {
        const step = document.createElement('div');
        const stageIdx = ORDER_STAGES.indexOf(stage);
        const currIdx = ORDER_STAGES.indexOf(order.stage);
        step.className = `progress-step ${stageIdx <= currIdx ? 'active' : ''}`;
        const stepLabel = document.createElement('span');
        stepLabel.textContent = STAGE_LABELS[stage];
        step.appendChild(stepLabel);
        progress.appendChild(step);
      });

      const eta = document.createElement('p');
      eta.className = 'order-eta';
      eta.textContent = order.stage === 'delivered'
        ? '✅ Delivered to your seat!'
        : `🛵 ETA: ~${order.estimatedMins} minutes from order placement`;

      card.appendChild(header);
      card.appendChild(progress);
      card.appendChild(eta);
      ordersEl.appendChild(card);
    });
  }
}
