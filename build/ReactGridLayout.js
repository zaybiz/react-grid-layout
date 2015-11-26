'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

var React = require('react');
var GridItem = require('./GridItem');
var utils = require('./utils');
var PureDeepRenderMixin = require('./mixins/PureDeepRenderMixin');
var WidthListeningMixin = require('./mixins/WidthListeningMixin');

/**
 * A reactive, fluid grid layout with draggable, resizable components.
 */
var ReactGridLayout = React.createClass({
  displayName: 'ReactGridLayout',

  mixins: [PureDeepRenderMixin, WidthListeningMixin],

  propTypes: {
    //
    // Basic props
    //

    // If true, the container height swells and contracts to fit contents
    autoSize: React.PropTypes.bool,
    // # of cols.
    cols: React.PropTypes.number,

    // A selector that will not be draggable.
    draggableCancel: React.PropTypes.string,
    // A selector for the draggable handler
    draggableHandle: React.PropTypes.string,

    // If true, the layout will compact vertically
    verticalCompact: React.PropTypes.bool,

    // layout is an array of object with the format:
    // {x: Number, y: Number, w: Number, h: Number}
    layout: function layout(props, propName, componentName) {
      var layout = props.layout;
      // I hope you're setting the _grid property on the grid items
      if (layout === undefined) return;
      utils.validateLayout(layout, 'layout');
    },

    layouts: function layouts(props, propName, componentName) {
      if (props.layouts) {
        throw new Error("ReactGridLayout does not use `layouts`: Use ReactGridLayout.Responsive.");
      }
    },

    // margin between items [x, y] in px
    margin: React.PropTypes.array,
    // Rows have a static height, but you can change this based on breakpoints if you like
    rowHeight: React.PropTypes.number,

    //
    // Flags
    //
    isDraggable: React.PropTypes.bool,
    isResizable: React.PropTypes.bool,
    // Use CSS transforms instead of top/left
    useCSSTransforms: React.PropTypes.bool,

    //
    // Callbacks
    //

    // Callback so you can save the layout.
    // Calls back with (currentLayout, allLayouts). allLayouts are keyed by breakpoint.
    onLayoutChange: React.PropTypes.func,

    // Calls when drag starts. Callback is of the signature (layout, oldItem, newItem, placeholder, e).
    // All callbacks below have the same signature. 'start' and 'stop' callbacks omit the 'placeholder'.
    onDragStart: React.PropTypes.func,
    // Calls on each drag movement.
    onDrag: React.PropTypes.func,
    // Calls when drag is complete.
    onDragStop: React.PropTypes.func,
    //Calls when resize starts.
    onResizeStart: React.PropTypes.func,
    // Calls when resize movement happens.
    onResize: React.PropTypes.func,
    // Calls when resize is complete.
    onResizeStop: React.PropTypes.func,

    //
    // Other validations
    //

    // Children must not have duplicate keys.
    children: function children(props, propName, componentName) {
      React.PropTypes.node.apply(this, arguments);
      var children = props[propName];

      // Check children keys for duplicates. Throw if found.
      var keys = {};
      React.Children.forEach(children, function (child, i, list) {
        if (keys[child.key]) {
          throw new Error("Duplicate child key found! This will cause problems in ReactGridLayout.");
        }
        keys[child.key] = true;
      });
    }
  },

  getDefaultProps: function getDefaultProps() {
    return {
      autoSize: true,
      cols: 12,
      rowHeight: 150,
      layout: [],
      margin: [10, 10],
      isDraggable: true,
      isResizable: true,
      useCSSTransforms: true,
      verticalCompact: true,
      onLayoutChange: function onLayoutChange() {},
      onDragStart: function onDragStart() {},
      onDrag: function onDrag() {},
      onDragStop: function onDragStop() {},
      onResizeStart: function onResizeStart() {},
      onResize: function onResize() {},
      onResizeStop: function onResizeStop() {}
    };
  },

  getInitialState: function getInitialState() {
    return {
      activeDrag: null,
      isMounted: false,
      layout: utils.synchronizeLayoutWithChildren(this.props.layout, this.props.children, this.props.cols, this.props.verticalCompact),
      width: this.props.initialWidth
    };
  },

  componentDidMount: function componentDidMount() {
    // Call back with layout on mount. This should be done after correcting the layout width
    // to ensure we don't rerender with the wrong width.
    this.props.onLayoutChange(this.state.layout);
    this.setState({ isMounted: true });
  },

  componentWillReceiveProps: function componentWillReceiveProps(nextProps) {
    // This allows you to set the width manually if you like.
    // Use manual width changes in combination with `listenToWindowResize: false`
    if (nextProps.width !== this.props.width) this.onWidthChange(nextProps.width);

    // If children change, regenerate the layout.
    if (nextProps.children.length !== this.props.children.length) {
      this.setState({
        layout: utils.synchronizeLayoutWithChildren(this.state.layout, nextProps.children, nextProps.cols, this.props.verticalCompact)
      });
    }

    // Allow parent to set layout directly.
    if (nextProps.layout && JSON.stringify(nextProps.layout) !== JSON.stringify(this.state.layout)) {
      this.setState({
        layout: utils.synchronizeLayoutWithChildren(nextProps.layout, nextProps.children, nextProps.cols, this.props.verticalCompact)
      });
    }
  },

  componentDidUpdate: function componentDidUpdate(prevProps, prevState) {
    // Call back so we can store the layout
    // Do it only when a resize/drag is not active, otherwise there are way too many callbacks
    if (this.state.layout !== prevState.layout && !this.state.activeDrag) {
      this.props.onLayoutChange(this.state.layout, this.state.layouts);
    }
  },

  /**
   * Calculates a pixel value for the container.
   * @return {String} Container height in pixels.
   */
  containerHeight: function containerHeight() {
    if (!this.props.autoSize) return;
    return utils.bottom(this.state.layout) * this.props.rowHeight + this.props.margin[1] + 'px';
  },

  /**
   * When the width changes, save it to state. This helps with left/width calculations.
   */
  onWidthChange: function onWidthChange(width) {
    this.setState({ width: width });
  },

  /**
   * When dragging starts
   * @param {Number} i Index of the child
   * @param {Number} x X position of the move
   * @param {Number} y Y position of the move
   * @param {Event} e The mousedown event
   * @param {Element} element The current dragging DOM element
   * @param {Object} position Drag information
   */
  onDragStart: function onDragStart(i, x, y, _ref) {
    var e = _ref.e;
    var element = _ref.element;
    var position = _ref.position;

    var layout = this.state.layout;
    var l = utils.getLayoutItem(layout, i);

    // No need to clone, `l` hasn't changed.
    this.props.onDragStart(layout, l, l, null, e);
  },
  /**
   * Each drag movement create a new dragelement and move the element to the dragged location
   * @param {Number} i Index of the child
   * @param {Number} x X position of the move
   * @param {Number} y Y position of the move
   * @param {Event} e The mousedown event
   * @param {Element} element The current dragging DOM element
   * @param {Object} position Drag information
   */
  onDrag: function onDrag(i, x, y, _ref2) {
    var e = _ref2.e;
    var element = _ref2.element;
    var position = _ref2.position;

    var layout = this.state.layout;
    var l = utils.getLayoutItem(layout, i);
    // Clone layout item so we can pass it to the callback.
    var oldL = utils.clone(l);

    // Create placeholder (display only)
    var placeholder = {
      w: l.w, h: l.h, x: l.x, y: l.y, placeholder: true, i: i
    };

    // Move the element to the dragged location.
    layout = utils.moveElement(layout, l, x, y, true /* isUserAction */);

    this.props.onDrag(layout, oldL, l, placeholder, e);

    this.setState({
      layout: utils.compact(layout, this.props.verticalCompact),
      activeDrag: placeholder
    });
  },

  /**
   * When dragging stops, figure out which position the element is closest to and update its x and y.
   * @param  {Number} i Index of the child.
   * @param {Number} i Index of the child
   * @param {Number} x X position of the move
   * @param {Number} y Y position of the move
   * @param {Event} e The mousedown event
   * @param {Element} element The current dragging DOM element
   * @param {Object} position Drag information
   */
  onDragStop: function onDragStop(i, x, y, _ref3) {
    var e = _ref3.e;
    var element = _ref3.element;
    var position = _ref3.position;

    var layout = this.state.layout;
    var l = utils.getLayoutItem(layout, i);
    var oldL = utils.clone(l);

    // Move the element here
    layout = utils.moveElement(layout, l, x, y, true /* isUserAction */);

    this.props.onDragStop(layout, oldL, l, null, e);

    // Set state
    this.setState({ layout: utils.compact(layout, this.props.verticalCompact), activeDrag: null });
  },

  onResizeStart: function onResizeStart(i, w, h, _ref4) {
    var e = _ref4.e;
    var element = _ref4.element;
    var size = _ref4.size;

    var layout = this.state.layout;
    var l = utils.getLayoutItem(layout, i);

    // No need to clone, item hasn't changed
    this.props.onResizeStart(layout, l, l, null, e);
  },

  onResize: function onResize(i, w, h, _ref5) {
    var e = _ref5.e;
    var element = _ref5.element;
    var size = _ref5.size;

    var layout = this.state.layout;
    var l = utils.getLayoutItem(layout, i);
    var oldL = utils.clone(l);

    // Set new width and height.
    l.w = w;
    l.h = h;

    // Create placeholder element (display only)
    var placeholder = {
      w: w, h: h, x: l.x, y: l.y, placeholder: true, i: i
    };

    this.props.onResize(layout, oldL, l, placeholder, e);

    // Re-compact the layout and set the drag placeholder.
    this.setState({ layout: utils.compact(layout, this.props.verticalCompact), activeDrag: placeholder });
  },

  onResizeStop: function onResizeStop(i, x, y, _ref6) {
    var e = _ref6.e;
    var element = _ref6.element;
    var size = _ref6.size;

    var layout = this.state.layout;
    var l = utils.getLayoutItem(layout, i);
    var oldL = utils.clone(l);

    this.props.onResizeStop(layout, oldL, l, null, e);

    this.setState({ activeDrag: null, layout: utils.compact(layout, this.props.verticalCompact) });
  },

  /**
   * Create a placeholder object.
   * @return {Element} Placeholder div.
   */
  placeholder: function placeholder() {
    if (!this.state.activeDrag) return '';

    // {...this.state.activeDrag} is pretty slow, actually
    return React.createElement(
      GridItem,
      {
        w: this.state.activeDrag.w,
        h: this.state.activeDrag.h,
        x: this.state.activeDrag.x,
        y: this.state.activeDrag.y,
        i: this.state.activeDrag.i,
        isPlaceholder: true,
        className: 'react-grid-placeholder',
        containerWidth: this.state.width,
        cols: this.props.cols,
        margin: this.props.margin,
        rowHeight: this.props.rowHeight,
        isDraggable: false,
        isResizable: false,
        useCSSTransforms: this.props.useCSSTransforms
      },
      React.createElement('div', null)
    );
  },

  /**
   * Given a grid item, set its style attributes & surround in a <Draggable>.
   * @param  {Element} child React element.
   * @param  {Number}  i     Index of element.
   * @return {Element}       Element wrapped in draggable and properly placed.
   */
  processGridItem: function processGridItem(child) {
    var i = child.key;
    var l = utils.getLayoutItem(this.state.layout, i);

    // watchStart property tells Draggable to react to changes in the start param
    // Must be turned off on the item we're dragging as the changes in `activeDrag` cause rerenders
    var drag = this.state.activeDrag;
    var moveOnStartChange = drag && drag.i === i ? false : true;

    // Parse 'static'. Any properties defined directly on the grid item will take precedence.
    var draggable, resizable;
    if (l['static'] || this.props.isDraggable === false) draggable = false;
    if (l['static'] || this.props.isResizable === false) resizable = false;

    return React.createElement(
      GridItem,
      _extends({
        containerWidth: this.state.width,
        cols: this.props.cols,
        margin: this.props.margin,
        rowHeight: this.props.rowHeight,
        moveOnStartChange: moveOnStartChange,
        cancel: this.props.draggableCancel,
        handle: this.props.draggableHandle,
        onDragStop: this.onDragStop,
        onDragStart: this.onDragStart,
        onDrag: this.onDrag,
        onResizeStart: this.onResizeStart,
        onResize: this.onResize,
        onResizeStop: this.onResizeStop,
        isDraggable: draggable,
        isResizable: resizable,
        useCSSTransforms: this.props.useCSSTransforms && this.state.isMounted,
        usePercentages: !this.state.isMounted
      }, l),
      child
    );
  },

  render: function render() {
    // Calculate classname
    var _props = this.props;
    var className = _props.className;

    var props = _objectWithoutProperties(_props, ['className']);

    className = 'react-grid-layout ' + (className || '');

    return React.createElement(
      'div',
      _extends({}, props, { className: className, style: { height: this.containerHeight() } }),
      React.Children.map(this.props.children, this.processGridItem),
      this.placeholder()
    );
  }
});

module.exports = ReactGridLayout;