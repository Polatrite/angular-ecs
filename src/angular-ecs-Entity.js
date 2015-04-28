// Entity
(function() {

  'use strict';

  angular.module('hc.ngEcs')

  /**
  * @ngdoc service
  * @name hc.ngEcs.Entity
  * @description
  * An Entity is bag of game properties (components).  By convention properties that do not start with a $ or _ are considered compoenets.
  * */
  .factory('Entity', function($components) {
    var _uuid = 0;
    function uuid() {
      var timestamp = new Date().getUTCMilliseconds();
      return '' + _uuid++ + '_' + timestamp;
    }

    function Entity(id) {
      if(false === (this instanceof Entity)) {
        return new Entity(id);
      }
      this._id = id || uuid();

      this.$componentAdded = new signals.Signal();
      this.$componentRemoved = new signals.Signal();

      this.$$signals = {};

    }

    /**
    * @ngdoc
    * @name hc.ngEcs.Entity#$on
    * @methodOf hc.ngEcs.Entity
    *
    * @description
    * Adds an event listener to the entity
    *
    * @example
    * <pre>
      entity.$on('upgrade', function() {  });
    * </pre>
    * @param {string} name Event name to listen on.
    * @param {function(event, ...args)} listener Function to call when the event is emitted.
    * @returns {function()} Returns a deregistration function for this listener.
    */
    Entity.prototype.$on = function(name, listener) {
      var sig = this.$$signals[name];
      if (!sig) {
        this.$$signals[name] = sig = new signals.Signal();
      }
      return sig.add(listener, this);
    };

    /**
    * @ngdoc
    * @name hc.ngEcs.Entity#$emit
    * @methodOf hc.ngEcs.Entity
    *
    * @description
    * Dispatches an event `name` calling notifying
    * registered {@link hc.ngEcs.Entity#$on} listeners
    *
    * @example
    * <pre>
      entity.$emit('upgrade');
    * </pre>
    * @param {string} name Event name to emit.
    * @param {...*} args Optional one or more arguments which will be passed onto the event listeners.
    * @returns {Entity} The entity
    */
    Entity.prototype.$emit = function(name) {
      var sig = this.$$signals[name];
      if (!sig) {return;}  // throw error?

      if (arguments.length > 1) {
        var args = Array.prototype.slice.call(arguments, 1);
        sig.dispatch.apply(sig, args);
      } else {
        sig.dispatch();
      }

      return this;
    };

    /**
      * @ngdoc
      * @name hc.ngEcs.Entity#$add
      * @methodOf hc.ngEcs.Entity
      *
      * @description
      * Adds a Component to the entity
      *
      * @example
      * <pre>
        entity.$add('position', {
          x: 1.0,
          y: 3.0
        });
      * </pre>
      * @param {string} key The name of the Component
      * @param {object} [instance] A component instance or a compoent configuration
      * @returns {Entity} The entity
      */
    Entity.prototype.$add = function(key, instance) {

      if (!key) {
        throw new Error('Can\'t add component with undefined key.');
      }

      // remove if exists
      if (this[key]) {
        this.$remove(key);
      }

      instance = angular.isDefined(instance) ? instance : {};

      // not a component by convention
      if (key.charAt(0) === '$' || key.charAt(0) === '_') {
        this[key] = instance;
        return;  // no emit
      }

      // is it a registered component?
      if ($components.hasOwnProperty(key)) {
        var Component = $components[key];
        if (typeof Component === 'function') {  // constructor
          if (instance instanceof Component) {  // already an instance
            this[key] = instance;
          } else {
            this[key] = new Component(this);
            angular.extend(this[key], instance);
          }
        } else {
          this[key] = angular.copy(Component);
          angular.extend(this[key], instance);
        }
        //this[key].$parent = this;
      } else {
        this[key] = instance;
      }

      this.$componentAdded.dispatch(this, key);
      //this.$world.$onComponentAdd(this,key);
      return this;
    };

    function isComponent(key) {
      return key.charAt(0) !== '$' && key.charAt(0) !== '_';
    }

    /**
    * @ngdoc
    * @name hc.ngEcs.Entity#$remove
    * @methodOf hc.ngEcs.Entity
    *
    * @description
    * Removes a component from the entity
    *
    * @example
    * <pre>
      entity.$remove('position');
    * </pre>
    * @param {string} key The name of the Component
    * @returns {Entity} The entity
    */
    Entity.prototype.$remove = function(key) {
      // not a component by convention
      if (isComponent(key)) {
        this.$componentRemoved.dispatch(this, key);
      }
      delete this[key];
      return this;
    };

    return Entity;
  });


})();