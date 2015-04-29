/**
 * angular-ecs
 * @version v0.0.11 - 2015-04-29
 * @link https://github.com/Hypercubed/angular-ecs
 * @author Jayson Harshbarger <>
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
// shims
(function () {
  'use strict';
  window.performance = window.performance || {};
  window.performance.now = function () {
    return window.performance.now || window.performance.webkitNow || window.performance.msNow || window.performance.mozNow || Date.now || function () {
      return new Date().getTime();
    };
  }();
  window.requestAnimationFrame = function () {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame || window.mozRequestAnimationFrame || function (callback) {
      return setTimeout(function () {
        var time = window.performance.now();
        callback(time);
      }, 16);
    };
  }();
  if (!Function.prototype.bind) {
    Function.prototype.bind = function (oThis) {
      if (typeof this !== 'function') {
        // closest thing possible to the ECMAScript 5
        // internal IsCallable function
        throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
      }
      var aArgs = Array.prototype.slice.call(arguments, 1), fToBind = this, FNOP = function () {
        }, fBound = function () {
          return fToBind.apply(this instanceof FNOP ? this : oThis, aArgs.concat(Array.prototype.slice.call(arguments)));
        };
      FNOP.prototype = this.prototype;
      fBound.prototype = new FNOP();
      return fBound;
    };
  }
}());
// main
(function () {
  'use strict';
  /**
  * @ngdoc overview
  * @name index
  *
  * @description
  * # An entity-component-system game framework made specifically for AngularJS.
  *
  * ## Why?
  *
  * There are many great game engines available for JavaScript.  Many include all the pieces needed to develop games in JavaScript; a canvas based rendering engine, optimized and specialized game loop, pixel asset management, dependency injection, and so on.  However, when developing a web game using AngularJS you may want to use only some parts of the game engine and leave other parts to Angular. To do this it often means playing tricks on the game engine to cooperate with angularjs. Angular-ecs is a entity-component-system built for and with AngularJS.  Angular-ecs was built to play nice with the angular architecture and to feel, as much as possible, like a native part of the angular framework.
  *
  *
  */
  function MapProvider() {
    var map = {};
    this.register = function (name, constructor) {
      if (angular.isObject(name)) {
        angular.extend(map, name);
      } else {
        map[name] = constructor;
      }
      return this;
    };
    this.$get = [
      '$injector',
      function ($injector) {
        angular.forEach(map, function (value, key) {
          if (angular.isFunction(value)) {
            map[key] = $injector.invoke(value, null, null, key);
          }
        });
        return map;
      }
    ];
  }
  angular.module('hc.ngEcs', []).provider('$entities', MapProvider).provider('$components', MapProvider).provider('$systems', MapProvider).provider('$families', MapProvider);
}());
// Entity
(function () {
  'use strict';
  angular.module('hc.ngEcs').factory('Entity', [
    '$components',
    function ($components) {
      var _uuid = 0;
      function uuid() {
        var timestamp = new Date().getUTCMilliseconds();
        return '' + _uuid++ + '_' + timestamp;
      }
      function Entity(id) {
        if (false === this instanceof Entity) {
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
      Entity.prototype.$on = function (name, listener) {
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
      Entity.prototype.$emit = function (name) {
        var sig = this.$$signals[name];
        if (!sig) {
          return;
        }
        // throw error?
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
      Entity.prototype.$add = function (key, instance) {
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
          if (typeof Component === 'function') {
            // constructor
            if (instance instanceof Component) {
              // already an instance
              this[key] = instance;
            } else {
              this[key] = new Component(this);
              angular.extend(this[key], instance);
            }
          } else {
            this[key] = angular.copy(Component);
            angular.extend(this[key], instance);
          }  //this[key].$parent = this;
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
      Entity.prototype.$remove = function (key) {
        // not a component by convention
        if (isComponent(key)) {
          this.$componentRemoved.dispatch(this, key);
        }
        delete this[key];
        return this;
      };
      return Entity;
    }
  ]);
}());
// Entity
(function () {
  'use strict';
  function Family(require) {
    var _this = [];
    Object.defineProperty(_this, 'require', {
      enumerable: false,
      value: require
    });
    Object.defineProperty(_this, 'entityAdded', {
      enumerable: false,
      value: new signals.Signal()
    });
    Object.defineProperty(_this, 'entityRemoved', {
      enumerable: false,
      value: new signals.Signal()
    });
    for (var method in Family.prototype) {
      if (Family.prototype.hasOwnProperty(method)) {
        Object.defineProperty(_this, method, {
          enumerable: false,
          value: Family.prototype[method]
        });
      }
    }
    return _this;
  }
  Family.prototype.isMatch = function (entity) {
    if (!this.require) {
      return true;
    }
    return this.require.every(function (d) {
      return entity.hasOwnProperty(d);
    });
  };
  Family.prototype.add = function (e) {
    // check if match?
    var index = this.indexOf(e);
    if (index < 0) {
      this.push(e);
      this.entityAdded.dispatch(e);
    }
  };
  Family.prototype.addIfMatch = function (e) {
    if (this.isMatch(e)) {
      this.add(e);
    }
  };
  Family.prototype.remove = function (e) {
    var index = this.indexOf(e);
    if (index > -1) {
      this.splice(index, 1);
      this.entityRemoved.dispatch(e);
    }
  };
  Family.prototype.removeIfMatch = function (e) {
    if (this.isMatch(e)) {
      this.remove(e);
    }
  };
  Family.makeId = function (require) {
    if (!require) {
      return '::';
    }
    return require.sort().join('::');
  };
  angular.module('hc.ngEcs').constant('Family', Family);
}());
// engine
(function () {
  'use strict';
  angular.module('hc.ngEcs').service('ngEcs', [
    '$rootScope',
    '$log',
    '$timeout',
    '$components',
    '$systems',
    '$entities',
    '$families',
    'Entity',
    'Family',
    function ($rootScope, $log, $timeout, $components, $systems, $entities, $families, Entity, Family) {
      function Ecs(opts) {
        this.components = $components;
        this.systems = $systems;
        this.entities = $entities;
        this.families = $families;
        angular.forEach($systems, function (value, key) {
          // todo: test this
          this.$s(key, value);
        });
        angular.forEach($entities, function (value) {
          // todo: test this
          this.$e(value);
        });
        //this.$timer = null;
        this.$playing = false;
        //this.$delay = 1000;
        this.$fps = 60;
        this.$interval = 1;
        this.$systemsQueue = [];
        // make $scenes?  Signal?
        angular.extend(this, opts);
      }
      Ecs.prototype.constructor = Ecs;
      /**
    * @ngdoc service
    * @name hc.ngEcs.ngEcs#$c
    * @methodOf hc.ngEcs.ngEcs
    *
    * @description Adds a component contructor
    *
    * @param {string} key component key
    * @param {function|object} constructor component constructor or prototype
    */
      Ecs.prototype.$c = function (key, constructor) {
        // perhaps add to $components
        $components[key] = constructor;
      };
      function getFamily(require) {
        var id = Family.makeId(require);
        var fam = $families[id];
        if (fam) {
          return fam;
        }
        fam = $families[id] = new Family(require);
        return fam;
      }
      /**
    * @ngdoc service
    * @name hc.ngEcs.ngEcs#$s
    * @methodOf hc.ngEcs.ngEcs
    *
    * @description Adds a system
    *
    * @param {string} key system key
    * @param {object} instance system configuration
    */
      Ecs.prototype.$s = function (key, instance) {
        // perhaps add to $systems
        $systems[key] = instance;
        this.$systemsQueue.unshift(instance);
        // todo: sort by priority, make scenes list
        instance.$family = getFamily(instance.$require);
        // todo: later only store id?
        if (instance.$addEntity) {
          instance.$family.entityAdded.add(instance.$addEntity);
        }
        if (instance.$removeEntity) {
          instance.$family.entityRemoved.add(instance.$removeEntity);
        }
        if (instance.$updateEach) {
          var _update = instance.$update ? instance.$update.bind(instance) : function () {
            };
          instance.$update = function (dt) {
            _update(dt);
            var i = -1, arr = this.$family, len = arr.length;
            while (++i < len) {
              instance.$updateEach(arr[i], dt);
            }
          };
        }
        if (angular.isDefined(instance.interval) && angular.isDefined(instance.$update)) {
          var __update = instance.$update.bind(instance);
          instance.acc = angular.isDefined(instance.acc) ? instance.acc : 0;
          instance.$update = function (dt) {
            this.acc += dt;
            if (this.acc > this.interval) {
              __update(dt);
              this.acc = this.acc - this.interval;
            }
          };
        }
        return instance;
      };
      /**
    * @ngdoc service
    * @name hc.ngEcs.ngEcs#$e
    * @methodOf hc.ngEcs.ngEcs
    *
    * @description Creates and adds an Entity
    * @see Entity
    *
    * @example
    * <pre>
      //config as array
      ngEcs.$e('player', ['position','control','collision']);

      //or config as object
      ngEcs.$e('player', {
        position: { x: 0, y: 50 },
        control: {}
        collision: {}
      });
    * </pre>
    *
    * @param {string} id (optional) entity id
    * @param {object|array} instance (optional) config object of entity
    * @return {Entity} The Entity
    */
      Ecs.prototype.$e = function (id, instance) {
        var self = this;
        if (typeof id === 'object') {
          instance = id;
          id = null;
        }
        var e = new Entity(id);
        e.$world = this;
        if (Array.isArray(instance)) {
          instance.forEach(function (key) {
            e.$add(key);
          });
        } else {
          angular.forEach(instance, function (value, key) {
            e.$add(key, value);
          });
        }
        onComponentAdded(e);
        e.$componentAdded.add(onComponentAdded, this);
        e.$componentRemoved.add(onComponentRemoved, this);
        $entities[e._id] = e;
        return e;
      };
      Ecs.prototype.$$removeEntity = function (e) {
        e.$world = null;
        angular.forEach(e, function (value, key) {
          if (key.charAt(0) !== '$' && key.charAt(0) !== '_') {
            e.$remove(key);
          }
        });
        angular.forEach($families, function (family) {
          family.remove(e);
        });
        e.$componentAdded.dispose();
        e.$componentRemoved.dispose();
        delete this.entities[e._id];
      };
      function onComponentAdded(entity, key) {
        angular.forEach($families, function (family) {
          if (family.require && key && family.require.indexOf(key) < 0) {
            return;
          }
          family.addIfMatch(entity);
        });
      }
      function onComponentRemoved(entity, key) {
        angular.forEach($families, function (family) {
          if (!family.require || key && family.require.indexOf(key) < 0) {
            return;
          }
          family.removeIfMatch(entity);
        });
      }
      /**
    * @ngdoc service
    * @name hc.ngEcs.ngEcs#$update
    * @methodOf hc.ngEcs.ngEcs
    *
    * @description Calls the update cycle
    */
      Ecs.prototype.$update = function (time) {
        time = angular.isUndefined(time) ? this.$interval : time;
        var arr = this.$systemsQueue, i = arr.length, system;
        while (i--) {
          system = arr[i];
          if (system.$update && system.$family.length > 0) {
            system.$update(time);
          }
        }
      };
      Ecs.prototype.$render = function (time) {
        time = angular.isUndefined(time) ? this.$interval : time;
        var arr = this.$systemsQueue, i = arr.length, system;
        while (i--) {
          system = arr[i];
          if (system.$render) {
            system.$render(time);
          }
        }
      };
      /**
    * @ngdoc service
    * @name hc.ngEcs.ngEcs#$start
    * @methodOf hc.ngEcs.ngEcs
    *
    * @description Starts the game loop
    */
      Ecs.prototype.$start = function () {
        if (this.$playing) {
          return;
        }
        this.$playing = true;
        var self = this, now, last = window.performance.now(), dt = 0, DT = 0, step;
        function frame() {
          if (!self.$playing) {
            return;
          }
          now = window.performance.now();
          DT = Math.min(1, (now - last) / 1000);
          dt = dt + DT;
          step = 1 / self.$fps;
          while (dt > step) {
            dt = dt - step;
            self.$update(step);
          }
          //self.$render(DT);
          //$rootScope.$apply();
          $rootScope.$applyAsync(function () {
            self.$render(DT);
          });
          last = now;
          window.requestAnimationFrame(frame);
        }
        window.requestAnimationFrame(frame);
      };
      /**
    * @ngdoc service
    * @name hc.ngEcs.ngEcs#$stop
    * @methodOf hc.ngEcs.ngEcs
    *
    * @description Stops the game loop
    */
      Ecs.prototype.$stop = function () {
        this.$playing = false;
      };
      return new Ecs();
    }
  ]);
}());