/**
 * promise的特性
 * 1、支持三种特性，但在某一时刻只有一种状态
 * 2、支持串行异步任务
 * 3、异步调用状态函数
 * 4、链式注册状态函数
 * 5、自动检测异常，并且将当前改成错误状态
 */
(function (root, factory) {
  if (typeof define !== 'undefined' && define.amd) {
    define(function () {
      return factory();
    });
  } else {
    root.ShuaiPromise = factory();
  }
})(this, function () {
  var __PENDING__ = 'pending';
  var __FILFULL__ = 'filfull';
  var __REJECT__ = 'reject';

  var ShuaiPromise = function (cb) {
    this.filfullCb = null;
    this.rejectCb = null;
    this.status = __PENDING__;

    cb(this._resolve.bind(this), this._reject.bind(this));
  };

  ShuaiPromise.all = function (ps) {
    // 等所有的promise是filfull状态后，才会产生最终值
    // 如果其中有一个是reject状态，则最终就是reject状态
    ps instanceof Array || (ps = [ ps ]);

    var count = ps.length;
    var idx = 0;
    var res = [];

    return new ShuaiPromise(function (resolve, reject) {
      ps.forEach(function (p, index) {
        p.then(function (val) {
          res[ index ] = val;

          if (++idx === count) {
            resolve(res);
          }
        }, function (reason) {
          reject(reason);
        })
      });
    });
  };

  ShuaiPromise.race = function (ps) {
    // 只要一个promise对象返回了结果，就以这个结果作为最终的结果
    ps instanceof Array || (ps = [ ps ]);

    var complete = false;

    return new ShuaiPromise(function (resolve, reject) {
      ps.forEach(function (p) {
        p.then(function (val) {
          if (!complete) {
            resolve(val);
            complete = true;
          }
        }, function (error) {
          reject(error);
          complete = true;
        })
      })
    });
  };

  ShuaiPromise.resolve = function (value) {
    return new ShuaiPromise(function (resolve) {
      resolve(value);
    });
  };

  ShuaiPromise.reject = function (value) {
    // 返回一个executor里调用reject的promise对象
    // 如果value是promise，则返回这个promise
    // 如果value为空或者为
    return new ShuaiPromise(function (_, reject) {
      reject(value);
    });
  };

  ShuaiPromise.prototype._resolve = function (value) {
    // 异步调用，如果同步此时并没有执行then也就没有得到状态回调
    var self = this;

    setTimeout(function () {
      // 因为在任何时刻promise都只有一种状态，并且改变状态前，必须是初始状态也就是'pending'
      if (self.status === __PENDING__) {
        // 加定时器，是为了让then先执行
        setTimeout(function () {
          self.status = __FILFULL__;
          self.filfullCb(value);
        });
      }
    }, 0);
  };

  ShuaiPromise.prototype._reject = function (reason) {
    var self = this;

    setTimeout(function () {
      if (self.status === __PENDING__) {
        self.status = __REJECT__;
        self.rejectCb(reason);
      }
    }, 0);
  };

  ShuaiPromise.prototype._createResolvePromise = function (resolvePromise, res, resolve, reject) {
    if (res instanceof ShuaiPromise) {
      res.then(function (val) {
        resolve(val);
      }, reject);
    } else {
      resolve(val);
    }
  };

  ShuaiPromise.prototype.then = function (fulfillCb, rejectCb) {
    var self = this, resPromise;

    // 如果没有rejectCb那么默认提供抛出异常的reject回调
    // 如果没有两个参数，则新建新的成功状态回调中，返回传入的参数，以便穿透
    fulfillCb = typeof fulfillCb === 'function' ? fulfillCb : function (value) { return value; };
    rejectCb = typeof rejectCb === 'function' ? rejectCb : function (error) { throw new Error(error); };

    // 产生新的promise对象，以便链式调用
    resPromise = new ShuaiPromise(function (resolve, reject) {
      // 重新对成功状态回调进行封装，目的是为了检测原有回调的结果
      // 如果返回的是promise对象，则调用then，成功回调中将resolve传入，就是等该promise执行完成，调用resolve执行当前then返回的promise
      // 如果普通值，则直接resolve
      self.filfullCb = function (value) {
        var res;

        // 对状态函数里进行try..catch，保证当出现异常或错误时候，能自动调用reject方法
        try {
          res = fulfillCb(value);
          self._createResolvePromise(resPromise, res, resolve, reject);
        } catch (err) {
          rejectCb(err.message);
        }
      };

      self.rejectCb = function (reason) {
        var res;

        try {
          res = rejectCb(reason);
          self._createResolvePromise(resPromise, res, resolve, reject);
        } catch (err) {
          rejectCb(err.message);
        }
      }
    });

    return resPromise;
  };

  ShuaiPromise.prototype.catch = function (rejectCb) {
    return this.then(null, rejectCb);
  };
});
