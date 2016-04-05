import os
from flask import Flask, request, session, g, redirect, url_for, \
     abort, render_template, flash
from firebase import firebase
from werkzeug import generate_password_hash, check_password_hash

app = Flask(__name__)

firebase = firebase.FirebaseApplication('https://karmadb.firebaseIO.com', None)


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/hello')
def hello():
    return render_template('hello.html')

@app.route('/login')
def login():
    # if('logged_in' in session):
    #     if(session['logged_in'] == False):
    #         return render_template('login.html');
    #     else:
    #         return redirect(url_for('landing'));
    return render_template('login.html');

@app.route('/checkAuth', methods=['GET', 'POST'])
def check_auth():
    user_name = request.form['inputUsername'] 
    user_password = request.form['inputPassword']   
    if request.method == 'POST':
        print(user_name)
        print(user_password)
        document = firebase.get('/users', user_name)
        print(document)
        # validate the received values  
        if not (user_name and user_password):
            print("empty fields")      
            return json.dumps({'status':'ERROR', 'errorMessage':'Enter all fields!'})   
        else:
            document = firebase.get('/users', user_name)
            print(document)
            if not document:
                return "Error Username"
                # return json.dumps({'status':'ERROR', 'errorMessage':"Email ID doesn't exist! Try again!"})
            # elif document["password"] == user_password:
            elif check_password_hash(document["password"], user_password):
                # session['logged_in'] = True;
                # session['username'] = user_name;
                # session['cust_id'] = '56c66be6a73e492741507c4b'
                return "OK"
                #return json.dumps({'status':'OK', 'redirect':url_for('main')})
            else:
                return "Error Credentials"
  

@app.route('/addUser', methods=['GET', 'POST'])
def add_user():
    if (request.method == "POST"):
        user_username = request.form['inputUserName']
        user_name = request.form['inputFullName']
        user_email = request.form['inputEmail']
        user_password = request.form['inputPassword']
        # user_type= request.form['inputType']
        # user_accountNumber = request.form['inputAccountNumber']
    # if(user_type == "organization"):
    #     user_frequency = "N/A";
    #     user_amount = "-1";
    # else:
    #     user_frequency = request.form['inputFrequency']
    #     user_amount = request.form['inputAmount']
    
    # validate the received values  
    if not (user_username and user_name and user_email and user_password):
        # check username uniqueness
        return render_template('register.html')  
    else:
        post = {'username':user_username, 'name': user_name, 'password':generate_password_hash(user_password)
        , 'email':user_email}
        firebase.put('/users', user_username, post)
        session['logged_in'] = True;
        session['username'] = user_username;
        # session['cust_id'] = user_accountNumber;
        return "Registered"
    # return json.dumps({'status':'OK', 'redirect':url_for('main')})
    return "end of func";
    
@app.route('/register')
def register():
    return render_template('register.html');



if __name__ == '__main__':
	app.secret_key=os.urandom(12)
	app.run(debug=True)