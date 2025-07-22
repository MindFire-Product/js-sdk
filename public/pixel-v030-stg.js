(function (_MFS, _mfaid, _mfpurl, _mfaccessid) {
  const identityServiceURI = "https://services-stg.mdl.io";
  const edgeServiceURI = "https://services-stg.mdl.io ";

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
   * @param {Object} filter   Query parameters to retrieve the record by, e.g. { email: "test@test.com" }. The fields in the filter object must be indexed so it can be usedto retrieve the record from the database.
   * @param {Number} expiry   JWT tokem expiration time in seconds.
   * @param {String} shardKey Pass the PURL value of the record which will be used as the shardKey.
   * @param {String} accessId The _id of the Remote Access entry.
   * @returns {Promise}       The authenticated record decorated by helper functions for convenience.
   *
   * @example
   * Without accessId (will use the first entry in the Remote Access config to authenticate the record):
   * const record = await _MFS.getAuthenticatedRecord("1234567890", { email: "test@test.com" }, 30, "johnsmith");
   * console.log(record);
   * 
   * With accessId (will use the Remote Accessentry with the provided accessId to authenticate the record):
   * const record = await _MFS.getAuthenticatedRecord("1234567890", { email: "test@test.com" }, 30, "johnsmith", "1234567890");
   * console.log(record);
   */
  _MFS.getAuthenticatedRecord = async function (aid, filter, expiry, shardKey, accessId) {
    let url, options;
    const payload = JSON.stringify({ aid, filter, expiry, shardKey });
    // If accessId is provided, use the PUT method to update the record.  
    if (accessId) {
      url = `${identityServiceURI}/api/identity/v1/list-record-auth/${accessId}`;
      options = { method: "PUT", body: payload };
    } else {
      url = `${identityServiceURI}/api/identity/v1/list-record-auth`;
      options = { method: "POST", body: payload };
    }
    const record = await callApi(url, options);

    /**
     * Updates the record's data fields
     * @param {*} params 
     * @returns 
     * 
     * @example
     * record.update({
     *   city: "New York",
     *   state: "NY",
     *   zip: "10001",
     *   country: "United States",
     *   phone: "1234567890",
     *   email: "test@test.com",
     * });
     */
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

    /**
     * Use app_code, event_code, event_path, event_element to define how'd you like to track the interactions of your landing page visitors.
     * @typedef {Object} EventParams
     * @property {String} app_code 
     * @property {String} event_code 
     * @property {String} event_path
     * @property {String} event_element
     * @property {String} event_date - The date of the event.
     * @property {Object} event_data - Custom data to be added to the event.
     */

    /**
     * Adds an event to the record.
     * @param {EventParams} params - The parameters for the event.
     * @returns {Promise} - The response from the API.
     * 
     * @example
     * record.addEvent({
     *   app_code: "305",
     *   event_code:"30561",
     *   event_path: "Direct Mail",
     *   event_element: "New Year Promo",
     *   event_data: { 
     *     referred_firstname: "Mary" ,
     *     referred_lastname: "Smith",
     *     referred_email: "marysmith@example.com",
     *     referred_phone: "1234567890",
     *     referral_method: "email",
     *     points: 10 
     *   }
     * });
     */
    record.addEvent = async function (eventParams) {
      eventParams.shardKey = eventParams.shardKey || shardKey; // Add shardKey if not provided;
      const url = `${edgeServiceURI}/api/contact-service/v1/events/${record.data._id}`;
      const options = {
        method: "PUT",
        headers: {
          authorization: `bearer ${record.jwt}`,
        },
        body: JSON.stringify(eventParams),
      };
      return await callApi(url, options);
    };

    /**
     * @typedef {Object} NewRecordParams
     * @property {String} event_path - The path of the event.
     * @property {String} event_element - The element of the event.
     * @property {String} event_date - The date of the event, defaults to the current date if not provided.
     * @property {Object} event_data - Custom data used to create the new record. Must include the PURL generation and deduplication fields.
     */

    /**
     * Adds a new record created by the authenticated record. 
     * The newly created record will have two special properties: 
     * referredBy: The _id of the authenticated record that added the new record.
     * referredPurl: The PURL of the authenticated record that added the new record
     * @param {NewRecordParams} params - The parameters for the new record.
     * @returns {Promise} - The response from the API.
     * 
     * @example
     * record.addNewRecord({
     *   event_path: "Direct Mail",
     *   event_element: "New Year Promo",  
     *   event_data: {  // this fields will be used to create the new record.
     *     firstname: "John", // purl generation field (required)
     *     lastname: "Doe", // purl generation field (required)
     *     email: "john.doe@example.com", // deduplication field (required)
     *     phone: "1234567890", // optional fields to add to the new record.
     *     no_duplicate: true, // prevents duplicate records from being created.
     * });
     */
    record.addNewRecord = async function (newRecodParams) {
      return await record.addEvent({
        app_code: "900",
        event_code: "99999", // This is the special event code that will create a new record. 
        event_path: newRecodParams.event_path,
        event_element: newRecodParams.event_element,
        event_date: newRecodParams.event_date || new Date().toISOString(),
        event_data: newRecodParams.event_data,
      });
    };

    return record;
  };


  /**
   * Returns a record with the public data defined by the account's Remote Access configs.
   * @param {String} aid      MindFire Account ID with Remote Access enabled for the domain/IP address.
   * @param {String} purl     The PURL value of the record.
   * @returns {Promise}       The record with the defined public data in the Remote Access config.
   *
   * @example
   * const record = await _MFS.getRecordPublicData();
   * console.log(record);
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
   * @param {String} accessId The _id of the Remote Access entry.
   * @returns {Promise}       The authenticated record decorated by helper functions for convenience.
   *
   * @example
   * const record = await _MFS.getRecord();
   * console.log(record);
   */
  _MFS.getRecord = async function (aid = _mfaid, filter = { purl: _mfpurl }, expiry = 60, shardKey = _mfpurl, accessId = _mfaccessid) {
    return await _MFS.getAuthenticatedRecord(aid, filter, expiry, shardKey, accessId);
  }

})(
  (window._MFS = window._MFS || {}),
  (window._mfaid = window._mfaid || ""),
  (window._mfpurl = window._mfpurl || ""),
  (window._mfaccessid = window._mfaccessid || "")
);