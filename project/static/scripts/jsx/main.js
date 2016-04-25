var StatusAlert = React.createClass({
  render: function(props) {
    var status = this.props.status;
    var label;
    if (status == "Unclaimed"){
      label = "status-alert";
    }
    else if (status == "Finished"){
      label = "status-success";
    }
    else if (status == "In Progress"){
      label = "status-warning";
    }
    else{
      label = "status-secondary"
    }
    return (
        <span className={label}> {status} </span>
    );
  }
});


var ActionComponent = React.createClass({
  render: function(props) {
    var status = this.props.status;
    var text;
    var label;
    var func;
    if (status == "Unclaimed"){
      text = "Give Help"
      func = this.props.claimItem
      label = "button success small";
    }
    else{
      text = "Error"
      label = "secondary button disabled small"
    }
    return (
        <span onClick={func} className={label}>{text}</span>
    );
  }
});


var QuestionPost = React.createClass({
  render: function() {
    var _this = this;
    this.props.items = _.sortBy(this.props.items, 'posted_at');

    var createItem = function(item, index) {
      if (item.status){
        return (
          <tr key={ index }>
            <td>{item.address}</td>
            <td>{item.room}</td>
            <td>{item.course}</td>
            <td>{item.description}</td>
            <td>
              <ActionComponent status={item.status} claimItem={ _this.props.claimItem.bind(null, item.key) } finishItem = { _this.props.finishItem.bind(null, item.key) } />
            </td>
          </tr>
        );
      }
    };
    return <tbody>{ this.props.items.map(createItem) }</tbody>;
  }
});


var ListQuestions = React.createClass({
  mixins:[ReactFireMixin],

  // sets initial state
  getInitialState: function(){
    var that = this;
    this.firebaseRef = new Firebase("https://karmadb.firebaseio.com");

    return { 
      user_uid: '',
      user_emaul: '',
      user_limit: '',
      current_user: '',
      items:[],
      address: '',
      course: '',
      description: '',
      status: 'Unclaimed',
      geolocation: {},
      room: '',
      disabledAutocomplete: false,
      current_address: '',
      tableStatus: 'initializing',
      initializingUserData: true,
      initializingUserLocation: true
    }
    
  },

  initAutocomplete: function() {
    // Create the autocomplete object, restricting the search to geographical
    // location types.

    var that = this;
    this.autocomplete = {};

    [this.refs.post_question_autocomplete, this.refs.current_address_autocomplete].forEach(function (autocompleteRef) {
      that.autocomplete[autocompleteRef.id] = new google.maps.places.Autocomplete(autocompleteRef,{types: ['geocode']});

      google.maps.event.addDomListener(autocompleteRef, 'keydown', function(e) { 
          if (e.keyCode == 13 && $('.pac-container:visible').length) { 
              e.preventDefault(); 
          }
      });


      that.autocomplete[autocompleteRef.id].addListener('place_changed', function() {
        var place = that.autocomplete[autocompleteRef.id].getPlace();
        that.setState({
          address: place.formatted_address,
          geolocation: {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          }
        });
      });

    });

  },


  componentWillMount: function() {
    var that = this;

    this.firebaseRef.onAuth(function (authData) {

      if (authData) {
        var user_uid = authData.uid;
        that.setState({user_uid: user_uid});
        that.bindAsObject(that.firebaseRef.child("users").child(user_uid), 'current_user');

        that.firebaseRef.child("users").child(user_uid).once("value", function(dataSnapshot) {
          var userObject = dataSnapshot.val();
          if (userObject !== null) {
            that.setState({user_email: userObject.email});
            that.setState({user_limit: userObject.limit}); 
            that.setState({initializingUserData: false});
          }
        });

      } else {
        window.location = '/login';
        console.log("Client unauthenticated.");
      }
    });

    this.geoFire = new GeoFire(this.firebaseRef.child("_geoFire"));

    this.geoQuery = this.geoFire.query({
      center: [40.110942, -88.21117400000003],
      radius: 0
    });

    this.geolocate(this.updateCurrentLocation, this.setLocationError);

    this.geoQuery.on("key_entered", function(itemKey) {
      itemKey = itemKey.split(":")[1];
      that.firebaseRef.child("items").child(itemKey).on("value", function(dataSnapshot) {
        var question = dataSnapshot.val();
        question.key = itemKey;

        if (question !== null){
          //to prevent race condition
          that.setState(function(currentState) {
            var newItems = _.without(currentState.items, _.findWhere(currentState.items, {key: itemKey}));
            if (question.status === 'Unclaimed') {
              newItems.push(question);
            }
            currentState.items = newItems;
            return currentState;
          });
        }
        if (that.state.items.length === 0) {
          that.setState({tableStatus:"empty"});
        } else {
          that.setState({tableStatus:"success"});
        }

      });
    });


    this.geoQuery.on("key_exited", function(itemKey) {
      itemKey = itemKey.split(":")[1];
      that.firebaseRef.child("items").child(itemKey).off("value");

      //to prevent race condition
      if ( !!_.findWhere(that.state.items, {key: itemKey}) ) {
        that.setState(function(currentState) {
            currentState.items = _.without(currentState.items, _.findWhere(currentState.items, {key: itemKey}));
            return currentState;
        }, function() {
            if (that.state.items.length === 0) {
              that.setState({tableStatus:"empty"});
            }
        })
      }
    });
  },

  componentDidMount: function() { 
    this.initAutocomplete();
    this.questionForm = new Foundation.Reveal($("#post-question-form"));
  },
  
  onChange: function(e) {
    this.setState({ [e.target.name]: e.target.value });
  },

  claimItem: function(key) {
    var author_uid;
    this.firebaseRef.child('items').child(key).once("value", function(dataSnapshot) {
      author_uid = dataSnapshot.child('author_uid').val();
      email = dataSnapshot.child('author_email').val();
    })

    this.firebaseRef.child('items').child(key).update({status: 'In Progress'});
    this.firebaseRef.child('users').child(author_uid).child('post').child(key).update({status: 'In Progress'});
  },

  finishItem: function(key) {
    var author_uid;
    var curr_limit;
    this.firebaseRef.child('items').child(key).once("value", function(dataSnapshot) {
      author_uid = dataSnapshot.child('author_uid').val();
    })
    this.firebaseRef.child('users').child(author_uid).once("value", function(dataSnapshot) {
      curr_limit = dataSnapshot.child('limit').val();
    })
    // curr_limit += 1
    this.firebaseRef.child('items').child(key).update({status: 'Finished'});
    this.firebaseRef.child('users').child(author_uid).child('post').child(key).update({status: 'Finished'});
    // firebaseRef.child('user').child(author_uid).update({limit: curr_limit});
    this.firebaseRef.child('users').child(author_uid).child('limit').transaction(function(current_value){
      return (current_value || 0) + 1
    });
  },

  geolocate: function(successCallback, errorCallback) {
    var that = this;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition( function(position) {
        that.setState({
          geolocation:{
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
        });
        var circle = new google.maps.Circle({
          center: that.state.geolocation,
          radius: position.coords.accuracy
        });
        _.forEach(that.autocomplete, function (autocomplete) {
          autocomplete.setBounds(circle.getBounds());
        });
        typeof successCallback === 'function' && successCallback();
      }, function(error) {
        console.log(error);
        if (error.code === 1) {
          alert("Please allow detect location or use the input box to fill your current location.");
        } else {
          alert("Please use the input box to fill your current location.");
        }
        typeof errorCallback === 'function' && errorCallback();
      });
    } else {
      console.log("Browser does not support geolocation.");
      alert("Please use the input box to fill your current location.");
      typeof errorCallback === 'function' && errorCallback();
    }


  },

  updateCurrentLocation: function() {
    var that = this;

    if (this.state.geolocation.lat) {
      this.geoQuery.updateCriteria({
        center: [this.state.geolocation.lat, this.state.geolocation.lng],
        radius: 1
      });
    }

    // update current address using address from the field if available
    if (this.state.address) {
      this.setState({current_address: this.state.address});
      this.setState({address: ''});
    } else if (this.state.initializingUserLocation){
      var geocoder = new google.maps.Geocoder();
      var latLng = new google.maps.LatLng(this.state.geolocation.lat, this.state.geolocation.lng);
      geocoder.geocode( { 'location': latLng}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK && results[0]) {
            that.setState({current_address:results[0].formatted_address});
            that.setState({address: ''});
        } else {
            that.setState({current_address: "Failed to locate your current location."});
            console.log("fail geocoding: " + status);
        }
        that.setState({initializingUserLocation: false});
      });
    } else {
      alert("Please fill in the input box to update your location.");
    }
      
  },

  setLocationError : function() {
    this.setState({initializingUserLocation: false});
    this.setState({disabledAutocomplete: false});
    this.setState({current_address : "Failed to get your current location."});
    this.setState({address : ""});
    this.setState({tableStatus : "failed"});
  },

  fillAddressFromGeolocate: function(e) {
    e.preventDefault()
    var that = this;

    this.setState({disabledAutocomplete: true});
    this.setState({address: "Finding your location..."});

    var successCallback = function() {
      var geocoder = new google.maps.Geocoder();
      var latLng = new google.maps.LatLng(that.state.geolocation.lat, that.state.geolocation.lng);

      geocoder.geocode( { 'location': latLng}, function(results, status) {
        that.setState({disabledAutocomplete: false});
        if (status == google.maps.GeocoderStatus.OK && results[0]) {
            that.setState({address:results[0].formatted_address});
        } else {
            that.setState({address: "Failed to locate your current location."});
            console.log("fail geocoding: " + status);
        }
      });

    }

    this.geolocate(successCallback, this.setLocationError);
    
  },

  handleClickPlace: function(place, e) {
    e.preventDefault();

    this.setState({
      address: place.address,
      geolocation: place.geolocation
    });
    this.geoQuery.updateCriteria({
      center: [place.geolocation.lat, place.geolocation.lng],
      radius: 1
    });
  },

  handleSubmit: function(e) {
    e.preventDefault();
    var that = this;

    if (this.state.current_user.limit > 0) {
      this.firebaseRef.child("users").child(this.state.user_uid).child('limit').transaction(function(current_value){
        return (current_value || 0) - 1
      });

      var dateNow = Date.now();

      var id = this.firebaseRef.child('items').push({
        address: this.state.address,
        course: this.state.course,
        status: 'Unclaimed',
        description: this.state.description,
        geolocation: this.state.geolocation,
        room: this.state.room,
        author_uid: this.state.user_uid,
        author_email: this.state.user_email,
        author_limit: this.state.current_user.limit,
        created_at: dateNow,
        posted_at: dateNow
      });

      if (this.state.geolocation.lat && this.state.geolocation.lng) {
        this.geoFire.set("items:" + id.key(), [this.state.geolocation.lat, this.state.geolocation.lng]);
      }

      this.firebaseRef.child("users").child(this.state.user_uid).child('post').child(id.key()).set({
        address: this.state.address,
        room: this.state.room,
        course: this.state.course,
        status: 'Unclaimed',
        description: this.state.description,
        created_at: dateNow,
        posted_at: dateNow
      });

      this.setState({
        address: '',
        room:'',
        course: '',
        status: 'Unclaimed',
        description: ''
      });

      that.closePostQuestionForm();
      window.location = "/history";
    }
    else{
      alert('Please wait while we initialize your data.')
    }
  },

  closePostQuestionForm: function() {
    this.questionForm.close();
  },

  openPostQuestionForm: function() {
    if (this.state.current_user.limit > 0) {
      this.questionForm.open();
    } else {
      if (this.state.current_user) {
        alert('Please wait for your questions to be answered.')
      } else {
        alert('Please wait while we initialize your data.')
      }
    }
  },

  render: function() {

    return (
      <div>
        <div className="row small-12 columns">
          <div className="columns small-6">
            <p>{ this.state.initializingUserData ? 'Initializing data..' : 'Hi ' + this.state.current_user.name + '!'}</p>
            <p>Logged In as: <strong>{ this.state.initializingUserData ? 'Initializing data..' : this.state.user_email}</strong></p>
          </div>
          <div className="columns small-6 text-center">
            <div className="button default" onClick={this.openPostQuestionForm}>
              <i className="fi-plus"></i> Post New Question
            </div>
            <p>Post limit: <strong>{ this.state.initializingUserData ? 'Initializing data..' : this.state.current_user.limit}</strong></p>
          </div>
        </div>

        <div className="row columns small-12 text-center">
          <div className="columns small-8">
            <div className="input-group">
              <span className="input-group-label" onClick= { this.fillAddressFromGeolocate } ><i className="fi-marker"></i></span>
                <input className="input-group-field" onChange={ this.onChange } type="text" id="current_address" ref="current_address_autocomplete"  
                name="address" value={this.state.address} placeholder="Change question's area location" disabled={this.state.disabledAutocomplete} />
            </div>
          </div>
          <div className="columns small-4 text-left">
            <button className="button warning" onClick={ this.updateCurrentLocation }>Update question&#145;s area</button>
          </div>
        </div>

        <div className="row columns small-12 text-center">
          <p>Questions are populated around this area: <strong>{ this.state.initializingUserLocation ? 'Finding your location...' : this.state.current_address}</strong></p>
        </div>

        <table className="table table-striped">

          <thead className="table-questions-head">
            <th>Address</th>
            <th>Room</th>
            <th>Course</th>
            <th>Description</th>
            <th>Action</th>
          </thead>
          {(() => {
            switch (this.state.tableStatus) {
              case "initializing":  
                return <tbody><tr><td className="full-td" colSpan="5"><h4>Finding people around you who needs your help...</h4></td></tr></tbody>;
              case "empty":
                return <tbody><tr><td className="full-td" colSpan="5"><h4>Nobody needs help right now around that area. Try again later or try another area.</h4></td></tr></tbody>;
              case "failed":
                return <tbody><tr><td className="full-td" colSpan="5"><h4>Please use the input box to fill your current location.</h4></td></tr></tbody>;
              case "success": 
                return <QuestionPost items={ this.state.items } claimItem={ this.claimItem } finishItem={ this.finishItem }/>;
              default:
                return <tbody><tr><td className="full-td" colSpan="5"><h4>Something went wrong. Please refresh the page.</h4></td></tr></tbody>;
            }
          })()}
        </table>

        <div className="reveal small" id="post-question-form" data-reveal>

          <a className="float-right" onClick={ this.closePostQuestionForm }>
            <span aria-hidden="true"><i className="fi-x"></i></span>
          </a>

          <form onSubmit={this.handleSubmit}>
            <div className="row column log-in-form">
                <h4 className="text-center">Post New Question</h4>
                <label>Type in your address/building name
                <div className="input-group">
                  <span className="input-group-label" onClick= { this.fillAddressFromGeolocate } ><i className="fi-marker"></i></span>
                    <input className="input-group-field" type="text" id="building" ref="post_question_autocomplete" onChange={ this.onChange }
                    value={ this.state.address } name="address" placeholder="Address/Place" disabled={this.state.disabledAutocomplete} />
                </div>
                <div>
                  or pick from these popular places:&nbsp;
                  {this.props.savedPlaces.map(function(item, i) {
                    return (
                        <a className="button hollow small default" onClick={ this.handleClickPlace.bind(null, item) } >{item.name}</a>
                    );
                  }.bind(this))}
                </div>

                </label>
                <label>Room/area
                    <input type="text" id="room" onChange={ this.onChange } value={ this.state.room } name="room" placeholder="SIEBL 1404"/>
                </label>
                <label>Course
                    <input type="text" id="course" onChange={ this.onChange } value={ this.state.course } name="course" placeholder="CS 225"/>
                </label>
                <label>Description
                    <input type="text" id="description" onChange={ this.onChange } value={ this.state.description } name="description" placeholder="Brief description" />
                </label>
                <button type="submit" data-close className="button success expanded" value="Submit">Submit</button>
            </div>
          </form>
        </div>

      </div>
    );
  }

});

var savedPlaces = [
  {
    name: "Siebel",
    address: "Thomas M. Siebel Center for Computer Science, 201 N Goodwin Ave, Urbana, IL 61801, USA",
    geolocation: {
      lat: 40.11402580000001,
      lng: -88.22480730000001
    } 
  },
  {
    name: "ECEB",
    address: "Electrical and Computer Engineering Building, 306 N Wright St, Urbana, IL 61801, USA",
    geolocation: {
      lat: 40.114918,
      lng: -88.22825309999996
    }
  },
  {
    name: "Grainger",
    address: "1301 W Springfield Ave, Urbana, IL 61801, USA",
    geolocation : {
      lat: 40.1123977,
      lng: -88.22727479999998
    }
  }
];

React.render(
  <ListQuestions savedPlaces={savedPlaces} />,
  document.getElementById('main')
);
