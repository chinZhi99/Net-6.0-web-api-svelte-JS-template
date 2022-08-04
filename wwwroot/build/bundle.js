
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.49.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const configStore = writable({});

    /* svelte-app\components\navbar.svelte generated by Svelte v3.49.0 */
    const file$5 = "svelte-app\\components\\navbar.svelte";

    function create_fragment$5(ctx) {
    	let nav;
    	let div1;
    	let a;
    	let i;
    	let t0;
    	let button;
    	let span;
    	let t1;
    	let div0;
    	let ul;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			div1 = element("div");
    			a = element("a");
    			i = element("i");
    			t0 = space();
    			button = element("button");
    			span = element("span");
    			t1 = space();
    			div0 = element("div");
    			ul = element("ul");
    			if (default_slot) default_slot.c();
    			attr_dev(i, "class", "fa fa-home whiteText");
    			add_location(i, file$5, 20, 8, 552);
    			attr_dev(a, "class", "navbar-brand");
    			attr_dev(a, "href", "#");
    			add_location(a, file$5, 19, 6, 473);
    			attr_dev(span, "class", "navbar-toggler-icon");
    			add_location(span, file$5, 31, 8, 893);
    			attr_dev(button, "class", "navbar-toggler");
    			attr_dev(button, "type", "button");
    			attr_dev(button, "data-bs-toggle", "collapse");
    			attr_dev(button, "data-bs-target", "#navbarSupportedContent");
    			attr_dev(button, "aria-controls", "navbarSupportedContent");
    			attr_dev(button, "aria-expanded", "false");
    			attr_dev(button, "aria-label", "Toggle navigation");
    			add_location(button, file$5, 22, 6, 608);
    			attr_dev(ul, "class", "navbar-nav me-auto mb-2 mb-lg-0");
    			add_location(ul, file$5, 34, 8, 1030);
    			attr_dev(div0, "class", "collapse navbar-collapse");
    			attr_dev(div0, "id", "navbarSupportedContent");
    			add_location(div0, file$5, 33, 6, 954);
    			attr_dev(div1, "class", "container-fluid");
    			add_location(div1, file$5, 18, 4, 436);
    			attr_dev(nav, "class", "navbar navbar-expand-lg navbar-dark bg-dark");
    			add_location(nav, file$5, 17, 0, 373);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, div1);
    			append_dev(div1, a);
    			append_dev(a, i);
    			append_dev(div1, t0);
    			append_dev(div1, button);
    			append_dev(button, span);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, ul);

    			if (default_slot) {
    				default_slot.m(ul, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*dispatchPageNavigation*/ ctx[0], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Navbar', slots, ['default']);
    	const dispatch = createEventDispatcher();

    	const dispatchPageNavigation = () => {
    		dispatch('message', { text: 'Index' });
    	};

    	let config = null;

    	configStore.subscribe(data => {
    		config = data;
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Navbar> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(1, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		dispatchPageNavigation,
    		configStore,
    		config
    	});

    	$$self.$inject_state = $$props => {
    		if ('config' in $$props) config = $$props.config;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [dispatchPageNavigation, $$scope, slots];
    }

    class Navbar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Navbar",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* svelte-app\pages\index.svelte generated by Svelte v3.49.0 */

    const file$4 = "svelte-app\\pages\\index.svelte";

    function create_fragment$4(ctx) {
    	let div3;
    	let div0;
    	let t0;
    	let div1;
    	let h1;
    	let t2;
    	let div2;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Index";
    			t2 = space();
    			div2 = element("div");
    			attr_dev(div0, "class", "col-1");
    			add_location(div0, file$4, 1, 4, 23);
    			add_location(h1, file$4, 3, 8, 108);
    			attr_dev(div1, "class", "col-10 border border-secondary");
    			add_location(div1, file$4, 2, 4, 54);
    			attr_dev(div2, "class", "col-1");
    			add_location(div2, file$4, 5, 4, 140);
    			attr_dev(div3, "class", "row");
    			add_location(div3, file$4, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div3, t0);
    			append_dev(div3, div1);
    			append_dev(div1, h1);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Pages', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Pages> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Pages extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Pages",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* svelte-app\pages\todo.svelte generated by Svelte v3.49.0 */

    const file$3 = "svelte-app\\pages\\todo.svelte";

    function create_fragment$3(ctx) {
    	let div4;
    	let div0;
    	let t0;
    	let div2;
    	let h1;
    	let t2;
    	let h30;
    	let t4;
    	let form0;
    	let input0;
    	let t5;
    	let input1;
    	let t6;
    	let div1;
    	let h31;
    	let t8;
    	let form1;
    	let input2;
    	let t9;
    	let input3;
    	let t10;
    	let input4;
    	let t11;
    	let input5;
    	let t12;
    	let a;
    	let t14;
    	let p;
    	let t15;
    	let table;
    	let tr;
    	let th0;
    	let t17;
    	let th1;
    	let t19;
    	let th2;
    	let t20;
    	let th3;
    	let t21;
    	let tbody;
    	let t22;
    	let div3;

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div2 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Todo CRUD";
    			t2 = space();
    			h30 = element("h3");
    			h30.textContent = "Add";
    			t4 = space();
    			form0 = element("form");
    			input0 = element("input");
    			t5 = space();
    			input1 = element("input");
    			t6 = space();
    			div1 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Edit";
    			t8 = space();
    			form1 = element("form");
    			input2 = element("input");
    			t9 = space();
    			input3 = element("input");
    			t10 = space();
    			input4 = element("input");
    			t11 = space();
    			input5 = element("input");
    			t12 = space();
    			a = element("a");
    			a.textContent = "✖";
    			t14 = space();
    			p = element("p");
    			t15 = space();
    			table = element("table");
    			tr = element("tr");
    			th0 = element("th");
    			th0.textContent = "Is Complete?";
    			t17 = space();
    			th1 = element("th");
    			th1.textContent = "Name";
    			t19 = space();
    			th2 = element("th");
    			t20 = space();
    			th3 = element("th");
    			t21 = space();
    			tbody = element("tbody");
    			t22 = space();
    			div3 = element("div");
    			attr_dev(div0, "class", "col-1");
    			add_location(div0, file$3, 5, 4, 126);
    			add_location(h1, file$3, 7, 6, 205);
    			add_location(h30, file$3, 8, 6, 231);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "add-name");
    			attr_dev(input0, "placeholder", "New to-do");
    			add_location(input0, file$3, 10, 8, 331);
    			attr_dev(input1, "type", "submit");
    			input1.value = "Add";
    			add_location(input1, file$3, 11, 8, 400);
    			attr_dev(form0, "action", "javascript:void(0);");
    			attr_dev(form0, "method", "POST");
    			attr_dev(form0, "onsubmit", "addItem()");
    			add_location(form0, file$3, 9, 6, 251);
    			add_location(h31, file$3, 15, 8, 513);
    			attr_dev(input2, "type", "hidden");
    			attr_dev(input2, "id", "edit-id");
    			add_location(input2, file$3, 17, 10, 607);
    			attr_dev(input3, "type", "checkbox");
    			attr_dev(input3, "id", "edit-isComplete");
    			add_location(input3, file$3, 18, 10, 655);
    			attr_dev(input4, "type", "text");
    			attr_dev(input4, "id", "edit-name");
    			add_location(input4, file$3, 19, 10, 713);
    			attr_dev(input5, "type", "submit");
    			input5.value = "Save";
    			add_location(input5, file$3, 20, 10, 761);
    			attr_dev(a, "onclick", "closeInput()");
    			attr_dev(a, "aria-label", "Close");
    			add_location(a, file$3, 21, 10, 809);
    			attr_dev(form1, "action", "javascript:void(0);");
    			attr_dev(form1, "onsubmit", "updateItem()");
    			add_location(form1, file$3, 16, 8, 536);
    			attr_dev(div1, "id", "editForm");
    			set_style(div1, "display", "none");
    			add_location(div1, file$3, 14, 6, 462);
    			attr_dev(p, "id", "counter");
    			add_location(p, file$3, 25, 6, 909);
    			add_location(th0, file$3, 29, 10, 972);
    			add_location(th1, file$3, 30, 10, 1005);
    			add_location(th2, file$3, 31, 10, 1030);
    			add_location(th3, file$3, 32, 10, 1048);
    			add_location(tr, file$3, 28, 8, 956);
    			attr_dev(tbody, "id", "todos");
    			add_location(tbody, file$3, 34, 8, 1079);
    			add_location(table, file$3, 27, 6, 939);
    			attr_dev(div2, "class", "col-10 border border-secondary");
    			add_location(div2, file$3, 6, 4, 153);
    			attr_dev(div3, "class", "col-1");
    			add_location(div3, file$3, 37, 4, 1133);
    			attr_dev(div4, "class", "row");
    			add_location(div4, file$3, 4, 0, 103);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div0);
    			append_dev(div4, t0);
    			append_dev(div4, div2);
    			append_dev(div2, h1);
    			append_dev(div2, t2);
    			append_dev(div2, h30);
    			append_dev(div2, t4);
    			append_dev(div2, form0);
    			append_dev(form0, input0);
    			append_dev(form0, t5);
    			append_dev(form0, input1);
    			append_dev(div2, t6);
    			append_dev(div2, div1);
    			append_dev(div1, h31);
    			append_dev(div1, t8);
    			append_dev(div1, form1);
    			append_dev(form1, input2);
    			append_dev(form1, t9);
    			append_dev(form1, input3);
    			append_dev(form1, t10);
    			append_dev(form1, input4);
    			append_dev(form1, t11);
    			append_dev(form1, input5);
    			append_dev(form1, t12);
    			append_dev(form1, a);
    			append_dev(div2, t14);
    			append_dev(div2, p);
    			append_dev(div2, t15);
    			append_dev(div2, table);
    			append_dev(table, tr);
    			append_dev(tr, th0);
    			append_dev(tr, t17);
    			append_dev(tr, th1);
    			append_dev(tr, t19);
    			append_dev(tr, th2);
    			append_dev(tr, t20);
    			append_dev(tr, th3);
    			append_dev(table, t21);
    			append_dev(table, tbody);
    			append_dev(div4, t22);
    			append_dev(div4, div3);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Todo', slots, []);
    	getItems();
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Todo> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Todo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Todo",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* svelte-app\pages\serverhealth.svelte generated by Svelte v3.49.0 */

    const file$2 = "svelte-app\\pages\\serverhealth.svelte";

    function create_fragment$2(ctx) {
    	let div4;
    	let div0;
    	let t0;
    	let div2;
    	let h1;
    	let t2;
    	let h30;
    	let t4;
    	let form0;
    	let input0;
    	let t5;
    	let input1;
    	let t6;
    	let div1;
    	let h31;
    	let t8;
    	let form1;
    	let input2;
    	let t9;
    	let input3;
    	let t10;
    	let input4;
    	let t11;
    	let input5;
    	let t12;
    	let a;
    	let t14;
    	let p;
    	let t15;
    	let table;
    	let tr;
    	let th0;
    	let t17;
    	let th1;
    	let t19;
    	let th2;
    	let t20;
    	let th3;
    	let t21;
    	let tbody;
    	let t22;
    	let div3;

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div2 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Server Health CRUD";
    			t2 = space();
    			h30 = element("h3");
    			h30.textContent = "Add";
    			t4 = space();
    			form0 = element("form");
    			input0 = element("input");
    			t5 = space();
    			input1 = element("input");
    			t6 = space();
    			div1 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Edit";
    			t8 = space();
    			form1 = element("form");
    			input2 = element("input");
    			t9 = space();
    			input3 = element("input");
    			t10 = space();
    			input4 = element("input");
    			t11 = space();
    			input5 = element("input");
    			t12 = space();
    			a = element("a");
    			a.textContent = "✖";
    			t14 = space();
    			p = element("p");
    			t15 = space();
    			table = element("table");
    			tr = element("tr");
    			th0 = element("th");
    			th0.textContent = "Is Complete?";
    			t17 = space();
    			th1 = element("th");
    			th1.textContent = "Name";
    			t19 = space();
    			th2 = element("th");
    			t20 = space();
    			th3 = element("th");
    			t21 = space();
    			tbody = element("tbody");
    			t22 = space();
    			div3 = element("div");
    			attr_dev(div0, "class", "col-1");
    			add_location(div0, file$2, 1, 4, 23);
    			add_location(h1, file$2, 3, 6, 102);
    			add_location(h30, file$2, 4, 6, 137);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "add-name");
    			attr_dev(input0, "placeholder", "New to-do");
    			add_location(input0, file$2, 6, 8, 237);
    			attr_dev(input1, "type", "submit");
    			input1.value = "Add";
    			add_location(input1, file$2, 7, 8, 306);
    			attr_dev(form0, "action", "javascript:void(0);");
    			attr_dev(form0, "method", "POST");
    			attr_dev(form0, "onsubmit", "addItem()");
    			add_location(form0, file$2, 5, 6, 157);
    			add_location(h31, file$2, 11, 8, 419);
    			attr_dev(input2, "type", "hidden");
    			attr_dev(input2, "id", "edit-id");
    			add_location(input2, file$2, 13, 10, 513);
    			attr_dev(input3, "type", "checkbox");
    			attr_dev(input3, "id", "edit-isComplete");
    			add_location(input3, file$2, 14, 10, 561);
    			attr_dev(input4, "type", "text");
    			attr_dev(input4, "id", "edit-name");
    			add_location(input4, file$2, 15, 10, 619);
    			attr_dev(input5, "type", "submit");
    			input5.value = "Save";
    			add_location(input5, file$2, 16, 10, 667);
    			attr_dev(a, "onclick", "closeInput()");
    			attr_dev(a, "aria-label", "Close");
    			add_location(a, file$2, 17, 10, 715);
    			attr_dev(form1, "action", "javascript:void(0);");
    			attr_dev(form1, "onsubmit", "updateItem()");
    			add_location(form1, file$2, 12, 8, 442);
    			attr_dev(div1, "id", "editForm");
    			set_style(div1, "display", "none");
    			add_location(div1, file$2, 10, 6, 368);
    			attr_dev(p, "id", "counter");
    			add_location(p, file$2, 21, 6, 815);
    			add_location(th0, file$2, 25, 10, 878);
    			add_location(th1, file$2, 26, 10, 911);
    			add_location(th2, file$2, 27, 10, 936);
    			add_location(th3, file$2, 28, 10, 954);
    			add_location(tr, file$2, 24, 8, 862);
    			attr_dev(tbody, "id", "todos");
    			add_location(tbody, file$2, 30, 8, 985);
    			add_location(table, file$2, 23, 6, 845);
    			attr_dev(div2, "class", "col-10 border border-secondary");
    			add_location(div2, file$2, 2, 4, 50);
    			attr_dev(div3, "class", "col-1");
    			add_location(div3, file$2, 33, 4, 1039);
    			attr_dev(div4, "class", "row");
    			add_location(div4, file$2, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div0);
    			append_dev(div4, t0);
    			append_dev(div4, div2);
    			append_dev(div2, h1);
    			append_dev(div2, t2);
    			append_dev(div2, h30);
    			append_dev(div2, t4);
    			append_dev(div2, form0);
    			append_dev(form0, input0);
    			append_dev(form0, t5);
    			append_dev(form0, input1);
    			append_dev(div2, t6);
    			append_dev(div2, div1);
    			append_dev(div1, h31);
    			append_dev(div1, t8);
    			append_dev(div1, form1);
    			append_dev(form1, input2);
    			append_dev(form1, t9);
    			append_dev(form1, input3);
    			append_dev(form1, t10);
    			append_dev(form1, input4);
    			append_dev(form1, t11);
    			append_dev(form1, input5);
    			append_dev(form1, t12);
    			append_dev(form1, a);
    			append_dev(div2, t14);
    			append_dev(div2, p);
    			append_dev(div2, t15);
    			append_dev(div2, table);
    			append_dev(table, tr);
    			append_dev(tr, th0);
    			append_dev(tr, t17);
    			append_dev(tr, th1);
    			append_dev(tr, t19);
    			append_dev(tr, th2);
    			append_dev(tr, t20);
    			append_dev(tr, th3);
    			append_dev(table, t21);
    			append_dev(table, tbody);
    			append_dev(div4, t22);
    			append_dev(div4, div3);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Serverhealth', slots, []);
    	getItems();
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Serverhealth> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Serverhealth extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Serverhealth",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* svelte-app\pages\not-found.svelte generated by Svelte v3.49.0 */

    const file$1 = "svelte-app\\pages\\not-found.svelte";

    function create_fragment$1(ctx) {
    	let div3;
    	let div0;
    	let t0;
    	let div1;
    	let h1;
    	let t2;
    	let div2;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Page Not Found";
    			t2 = space();
    			div2 = element("div");
    			attr_dev(div0, "class", "col-1");
    			add_location(div0, file$1, 1, 4, 23);
    			add_location(h1, file$1, 3, 8, 108);
    			attr_dev(div1, "class", "col-10 border border-secondary");
    			add_location(div1, file$1, 2, 4, 54);
    			attr_dev(div2, "class", "col-1");
    			add_location(div2, file$1, 5, 4, 149);
    			attr_dev(div3, "class", "row");
    			add_location(div3, file$1, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div3, t0);
    			append_dev(div3, div1);
    			append_dev(div1, h1);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Not_found', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Not_found> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Not_found extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Not_found",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* svelte-app\App.svelte generated by Svelte v3.49.0 */
    const file = "svelte-app\\App.svelte";

    // (26:0) <Navbar on:message={handlePageNavigationOnMessage}>
    function create_default_slot(ctx) {
    	let li0;
    	let a0;
    	let t1;
    	let li1;
    	let a1;
    	let t3;
    	let li2;
    	let a2;
    	let t5;
    	let li3;
    	let a3;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			li0 = element("li");
    			a0 = element("a");
    			a0.textContent = "Home";
    			t1 = space();
    			li1 = element("li");
    			a1 = element("a");
    			a1.textContent = "Todo";
    			t3 = space();
    			li2 = element("li");
    			a2 = element("a");
    			a2.textContent = "ServerHealth";
    			t5 = space();
    			li3 = element("li");
    			a3 = element("a");
    			a3.textContent = "NotFound";
    			attr_dev(a0, "class", "nav-link");
    			attr_dev(a0, "aria-current", "Index");
    			attr_dev(a0, "href", "#");
    			toggle_class(a0, "active", /*currentPage*/ ctx[0] === "Index");
    			add_location(a0, file, 27, 2, 716);
    			attr_dev(li0, "class", "nav-item");
    			add_location(li0, file, 26, 1, 692);
    			attr_dev(a1, "class", "nav-link");
    			attr_dev(a1, "aria-current", "Todo");
    			attr_dev(a1, "href", "#");
    			toggle_class(a1, "active", /*currentPage*/ ctx[0] === "Todo");
    			add_location(a1, file, 32, 2, 908);
    			attr_dev(li1, "class", "nav-item");
    			add_location(li1, file, 31, 1, 884);
    			attr_dev(a2, "class", "nav-link");
    			attr_dev(a2, "aria-current", "Todo");
    			attr_dev(a2, "href", "#");
    			toggle_class(a2, "active", /*currentPage*/ ctx[0] === "ServerHealth");
    			add_location(a2, file, 37, 2, 1097);
    			attr_dev(li2, "class", "nav-item");
    			add_location(li2, file, 36, 1, 1073);
    			attr_dev(a3, "class", "nav-link");
    			attr_dev(a3, "aria-current", "Todo");
    			attr_dev(a3, "href", "#");
    			toggle_class(a3, "active", /*currentPage*/ ctx[0] === "NotFound");
    			add_location(a3, file, 42, 2, 1310);
    			attr_dev(li3, "class", "nav-item");
    			add_location(li3, file, 41, 1, 1286);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li0, anchor);
    			append_dev(li0, a0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, li1, anchor);
    			append_dev(li1, a1);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, li2, anchor);
    			append_dev(li2, a2);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, li3, anchor);
    			append_dev(li3, a3);

    			if (!mounted) {
    				dispose = [
    					listen_dev(a0, "click", /*click_handler*/ ctx[3], false, false, false),
    					listen_dev(a1, "click", /*click_handler_1*/ ctx[4], false, false, false),
    					listen_dev(a2, "click", /*click_handler_2*/ ctx[5], false, false, false),
    					listen_dev(a3, "click", /*click_handler_3*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*currentPage*/ 1) {
    				toggle_class(a0, "active", /*currentPage*/ ctx[0] === "Index");
    			}

    			if (dirty & /*currentPage*/ 1) {
    				toggle_class(a1, "active", /*currentPage*/ ctx[0] === "Todo");
    			}

    			if (dirty & /*currentPage*/ 1) {
    				toggle_class(a2, "active", /*currentPage*/ ctx[0] === "ServerHealth");
    			}

    			if (dirty & /*currentPage*/ 1) {
    				toggle_class(a3, "active", /*currentPage*/ ctx[0] === "NotFound");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(li1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(li2);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(li3);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(26:0) <Navbar on:message={handlePageNavigationOnMessage}>",
    		ctx
    	});

    	return block;
    }

    // (56:1) {:else}
    function create_else_block(ctx) {
    	let pagenotfound;
    	let current;
    	pagenotfound = new Not_found({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(pagenotfound.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(pagenotfound, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(pagenotfound.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(pagenotfound.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(pagenotfound, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(56:1) {:else}",
    		ctx
    	});

    	return block;
    }

    // (54:41) 
    function create_if_block_2(ctx) {
    	let serverhealth;
    	let current;
    	serverhealth = new Serverhealth({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(serverhealth.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(serverhealth, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(serverhealth.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(serverhealth.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(serverhealth, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(54:41) ",
    		ctx
    	});

    	return block;
    }

    // (52:33) 
    function create_if_block_1(ctx) {
    	let todo;
    	let current;
    	todo = new Todo({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(todo.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(todo, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(todo.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(todo.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(todo, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(52:33) ",
    		ctx
    	});

    	return block;
    }

    // (50:1) {#if currentPage == "Index"}
    function create_if_block(ctx) {
    	let index;
    	let current;
    	index = new Pages({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(index.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(index, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(index.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(index.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(index, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(50:1) {#if currentPage == \\\"Index\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let navbar;
    	let t;
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let current;

    	navbar = new Navbar({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	navbar.$on("message", /*handlePageNavigationOnMessage*/ ctx[2]);
    	const if_block_creators = [create_if_block, create_if_block_1, create_if_block_2, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*currentPage*/ ctx[0] == "Index") return 0;
    		if (/*currentPage*/ ctx[0] == "Todo") return 1;
    		if (/*currentPage*/ ctx[0] == "ServerHealth") return 2;
    		return 3;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			create_component(navbar.$$.fragment);
    			t = space();
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "container-fluid mt-3");
    			add_location(div, file, 48, 0, 1497);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(navbar, target, anchor);
    			insert_dev(target, t, anchor);
    			insert_dev(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const navbar_changes = {};

    			if (dirty & /*$$scope, currentPage*/ 257) {
    				navbar_changes.$$scope = { dirty, ctx };
    			}

    			navbar.$set(navbar_changes);
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index !== previous_block_index) {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(div, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navbar.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navbar.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(navbar, detaching);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let config = null;

    	configStore.subscribe(data => {
    		config = data;
    	});

    	/* Nav Logic */
    	let currentPage = "Index";

    	const handlePageNavigationOnClick = destination => {
    		$$invalidate(0, currentPage = destination);
    	};

    	const handlePageNavigationOnMessage = event => {
    		$$invalidate(0, currentPage = event.detail.text);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => handlePageNavigationOnClick("Index");
    	const click_handler_1 = () => handlePageNavigationOnClick("Todo");
    	const click_handler_2 = () => handlePageNavigationOnClick("ServerHealth");
    	const click_handler_3 = () => handlePageNavigationOnClick("NotFound");

    	$$self.$capture_state = () => ({
    		configStore,
    		Navbar,
    		Index: Pages,
    		Todo,
    		ServerHealth: Serverhealth,
    		PageNotFound: Not_found,
    		config,
    		currentPage,
    		handlePageNavigationOnClick,
    		handlePageNavigationOnMessage
    	});

    	$$self.$inject_state = $$props => {
    		if ('config' in $$props) config = $$props.config;
    		if ('currentPage' in $$props) $$invalidate(0, currentPage = $$props.currentPage);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		currentPage,
    		handlePageNavigationOnClick,
    		handlePageNavigationOnMessage,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
