(function (_MFS, _mfaid, _mfpurl) {
  const identityServiceURI = "https://services.mdl.io";
  const edgeServiceURI = "https://services.mdl.io";

  /**
   * Helper function that wraps the native fetch to make a JSON request and return the resolved data object from response.
   * @param {String} url
   * @param {Object} options
   * @returns {Object}
   */
  async function callApi(url, options) {
    options.headers = options.headers || {};
    options.headers["Accept"] = "application/json";
    options.headers["Content-Type"] = "application/json";
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * Authenticates a record with MindFire Identity Service and returns the record with a few added utility functions.
   * @param {String} aid      MindFire Account ID with Remote Access enabled for the domain/IP address.
   * @param {Object} filter   Query parameters to retrieve the record by, e.g. { email: "test@test.com" }.
   * @param {Number} expiry   JWT tokem expiration time in seconds.
   * @param {String} shardKey Pass the PURL value of the record which be used as the shardKey.
   * @returns {Promise}       The authenticated record decorated by helper functions for convenience.
   *
   */
  _MFS.getAuthenticatedRecord = async function (aid, filter, expiry, shardKey) {
    const url = `${identityServiceURI}/api/identity/v1/list-record-auth`;
    const options = {
      method: "POST",
      body: JSON.stringify({ aid, filter, expiry, shardKey }),
    };
    const record = await callApi(url, options);

    // Helper function to update the record
    record.update = async function (params) {
      params.shardKey = params.shardKey || shardKey; // Add the shardKey if not provided;
      const url = `${edgeServiceURI}/api/contact-service/v1/offers/${record.data._id}`;
      const options = {
        method: "PUT",
        headers: {
          authorization: `bearer ${record.jwt}`,
        },
        body: JSON.stringify(params),
      };
      return await callApi(url, options);
    }

    // Helper function to add an event to the record  
    record.addEvent = async function (params) {
      params.shardKey = params.shardKey || shardKey; // Add shardKey if not provided;
      const url = `${edgeServiceURI}/api/contact-service/v1/events/${record.data._id}`;
      const options = {
        method: "PUT",
        headers: {
          authorization: `bearer ${record.jwt}`,
        },
        body: JSON.stringify(params),
      };
      return await callApi(url, options);
    };
    
    return record;
  };


  /**
   * Returns a record only with public data as defined by remote access configs.
   * @param {String} aid      MindFire Account ID with remote access enabled for the domain/IP address.
   * @param {String} purl     The PURL value of the record.
   * @returns {Promise}       The record with the defined public data in the Remote Access config.
   *
   */
  _MFS.getRecordPublicData = async function (aid = _mfaid, purl = _mfpurl) {
    const url = `${identityServiceURI}/api/identity/v1/list-record-auth/${aid}/${purl}`;
    const options = {
      method: "GET",
    };
    return await callApi(url, options);
  }

  /**
   * Wraps the _MFS.getAuthenticatedRecord method to provide default options for convenience.
   * @param {String} aid      MindFire Account ID with Remote Access enabled for the domain/IP address.
   * @param {Object} filter   Query parameters to retrieve the record by, e.g. { email: "test@test.com" }.
   * @param {Number} expiry   JWT tokem expiration time in seconds.
   * @param {String} shardKey The PURL value of the record is used as the shardKey. 
   * @returns {Promise}       The authenticated record decorated by helper functions for convenience.
   *
   */
  _MFS.getRecord = async function (aid = _mfaid, filter = { purl: _mfpurl }, expiry = 60, shardKey = _mfpurl) {
    return await _MFS.getAuthenticatedRecord(aid, filter, expiry, shardKey);
  }

})(
  (window._MFS = window._MFS || {}),
  (window._mfaid = window._mfaid || ""),
  (window._mfpurl = window._mfpurl || "")
);