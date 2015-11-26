'use strict';

var utils = require('./utils');

var responsiveUtils = module.exports = {

  /**
   * Given a width, find the highest breakpoint that matches is valid for it (width > breakpoint).
   *
   * @param  {Object} breakpoints Breakpoints object (e.g. {lg: 1200, md: 960, ...})
   * @param  {Number} width Screen width.
   * @return {String}       Highest breakpoint that is less than width.
   */
  getBreakpointFromWidth: function getBreakpointFromWidth(breakpoints, width) {
    var sorted = responsiveUtils.sortBreakpoints(breakpoints);
    var matching = sorted[0];
    for (var i = 1, len = sorted.length; i < len; i++) {
      var breakpointName = sorted[i];
      if (width > breakpoints[breakpointName]) matching = breakpointName;
    }
    return matching;
  },

  /**
   * Given a breakpoint, get the # of cols set for it.
   * @param  {String} breakpoint Breakpoint name.
   * @param  {Object} cols       Map of breakpoints to cols.
   * @return {Number}            Number of cols.
   */
  getColsFromBreakpoint: function getColsFromBreakpoint(breakpoint, cols) {
    if (!cols[breakpoint]) {
      throw new Error("ResponsiveReactGridLayout: `cols` entry for breakpoint " + breakpoint + " is missing!");
    }
    return cols[breakpoint];
  },

  /**
   * Given existing layouts and a new breakpoint, find or generate a new layout.
   *
   * This finds the layout above the new one and generates from it, if it exists.
   *
   * @param  {Array} layouts     Existing layouts.
   * @param  {Array} breakpoints All breakpoints.
   * @param  {String} breakpoint New breakpoint.
   * @param  {String} breakpoint Last breakpoint (for fallback).
   * @param  {Number} cols       Column count at new breakpoint.
   * @param  {Boolean} verticalCompact Whether or not to compact the layout
   *   vertically.
   * @return {Array}             New layout.
   */
  findOrGenerateResponsiveLayout: function findOrGenerateResponsiveLayout(layouts, breakpoints, breakpoint, lastBreakpoint, cols, verticalCompact) {
    // If it already exists, just return it.
    if (layouts[breakpoint]) return layouts[breakpoint];
    // Find or generate the next layout
    var layout = layouts[lastBreakpoint];
    var breakpointsSorted = responsiveUtils.sortBreakpoints(breakpoints);
    var breakpointsAbove = breakpointsSorted.slice(breakpointsSorted.indexOf(breakpoint));
    for (var i = 0, len = breakpointsAbove.length; i < len; i++) {
      var b = breakpointsAbove[i];
      if (layouts[b]) {
        layout = layouts[b];
        break;
      }
    }
    layout = JSON.parse(JSON.stringify(layout || [])); // clone layout so we don't modify existing items
    return utils.compact(utils.correctBounds(layout, { cols: cols }), verticalCompact);
  },

  /**
   * Given breakpoints, return an array of breakpoints sorted by width. This is usually
   * e.g. ['xxs', 'xs', 'sm', ...]
   *
   * @param  {Object} breakpoints Key/value pair of breakpoint names to widths.
   * @return {Array}              Sorted breakpoints.
   */
  sortBreakpoints: function sortBreakpoints(breakpoints) {
    var keys = Object.keys(breakpoints);
    return keys.sort(function (a, b) {
      return breakpoints[a] - breakpoints[b];
    });
  }
};