// Step 1 ==================================
    var Ibc1 = require('ibm-blockchain-js');
    var ibc = new Ibc1(/*logger*/);             //you can pass a logger such as winston here - optional
    var chaincode = {};
    var app = require('express')();
    var http = require('http').Server(app);
    var bodyParser = require('body-parser');
    var fs = require('fs');
    var cfenv = require("cfenv");

    var g_cc;

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded()); 


    // ==================================
    // load peers manually or from VCAP, VCAP will overwrite hardcoded list!
    // ==================================
    try{
        console.log("load pre-file");
        //this hard coded list is intentionaly left here, feel free to use it when initially starting out
        //please create your own network when you are up and running
        var manual = JSON.parse(fs.readFileSync('bluemix-cred.json', 'utf8'));
        console.log('loading manual '+manual);
        //var manual = JSON.parse(fs.readFileSync('mycreds_bluemix.json', 'utf8'));
        var peers = manual.credentials.peers;
        console.log('loading hardcoded peers '+peers);
        var users = null;                                                                           //users are only found if security is on
        if(manual.credentials.users) users = manual.credentials.users;
        console.log('loading hardcoded users');
    }
    catch(e){
        console.log('Error - could not find hardcoded peers/users, this is okay if running in bluemix');
    }

    // ---- Load From VCAP aka Bluemix Services ---- //
    if(process.env.VCAP_SERVICES){                                                                  //load from vcap, search for service, 1 of the 3 should be found...
        var servicesObject = JSON.parse(process.env.VCAP_SERVICES);
        for(var i in servicesObject){
            if(i.indexOf('ibm-blockchain') >= 0){                                                   //looks close enough
                if(servicesObject[i][0].credentials.error){
                    console.log('!\n!\n! Error from Bluemix: \n', servicesObject[i][0].credentials.error, '!\n!\n');
                    peers = null;
                    users = null;
                    process.error = {type: 'network', msg: 'Due to overwhelming demand the IBM Blockchain Network service is at maximum capacity.  Please try recreating this service at a later date.'};
                }
                if(servicesObject[i][0].credentials && servicesObject[i][0].credentials.peers){     //found the blob, copy it to 'peers'
                    console.log('overwritting peers, loading from a vcap service: ', i);
                    peers = servicesObject[i][0].credentials.peers;
                    if(servicesObject[i][0].credentials.users){                                     //user field may or maynot exist, depends on if there is membership services or not for the network
                        console.log('overwritting users, loading from a vcap service: ', i);
                        users = servicesObject[i][0].credentials.users;
                    } 
                    else users = null;                                                              //no security
                    break;
                }
            }
        }
    }

    //filter for type1 users if we have any
    function prefer_type1_users(user_array){
        var ret = [];
        for(var i in users){
            if(users[i].enrollId.indexOf('type1') >= 0) {   //gather the type1 users
                ret.push(users[i]);
            }
        }

        if(ret.length === 0) ret = user_array;              //if no users found, just use what we have
        return ret;
    }

    //see if peer 0 wants tls or no tls
    function detect_tls_or_not(peer_array){
        var tls = false;
        if(peer_array[0] && peer_array[0].api_port_tls){
            if(!isNaN(peer_array[0].api_port_tls)) tls = true;
        }
        return tls;
    }

    // ==================================
    // configure ibc-js sdk
    // ==================================
    var options =   {
        /*network:{
            peers:   [{
                "api_host": "148.100.5.75",
                "api_port": 7050,
                "id":"CCXP_peer"
                //"id": "xxxxxx-xxxx-xxx-xxx-xxxxxxxxxxxx_vpx"
            }],
            users:  [{
                "enrollId": "test_user0",
                "enrollSecret": "MS9qrN8hFjlE"
            }],
            options: {                          //this is optional
                quiet: true, 
                timeout: 60000,
                tls: false,
            }
        },*/
        network:{
            peers: [peers[0]],                                                                  //lets only use the first peer! since we really don't need any more than 1
            users: prefer_type1_users(users),                                                   //dump the whole thing, sdk will parse for a good one
            options: {
                quiet: true,                                                            //detailed debug messages on/off true/false
                tls: detect_tls_or_not(peers),                                          //should app to peer communication use tls?
                maxRetry: 1                                                             //how many times should we retry register before giving up
            }
        },*/
        chaincode:{
            zip_url: 'https://github.com/xuchenhao001/hackathon-cc/raw/master/eric_cc.zip',
            unzip_dir: '/',
            git_url: 'https://github.com/xuchenhao001/hackathon-cc'
            //,deployed_name:'5413191f18c5cab35639e42515edbb47c12c2ce7306d107b7cc6e23b591a5a4c123c261fd0da1fdc2214047e0d168b4087b86b3c86d4d62a219b46b9a1abc48e'
        }
    };
    if(process.env.VCAP_SERVICES){
        console.log('\n[!] looks like you are in bluemix, I am going to clear out the deploy_name so that it deploys new cc.\n[!] hope that is ok budddy\n');
        options.chaincode.deployed_name = '';
    }

    // Step 2 ==================================
    ibc.load(options, cb_ready);

    // Step 3 ==================================
    function cb_ready(err, cc){                             //response has chaincode functions
        //app1.setup(ibc, cc);
        //app2.setup(ibc, cc);

    // Step 4 ==================================
        if(true){                //decide if I need to deploy or not
            g_cc = cc;
            cc.deploy('init', ['99'], {delay_ms: 30000}, function(e){                       //delay_ms is milliseconds to wait after deploy for conatiner to start, 50sec recommended
                console.log("success deployed");
                cb_deployed();
            });
        }
        else{
            g_cc = cc;
            console.log('chaincode summary file indicates chaincode has been previously deployed');
         
            cb_deployed();
        }
    }

    // Step 5 ==================================
    function cb_deployed(err){
        console.log('sdk has deployed code and waited');
        
        var port = process.env.VCAP_APP_PORT || 8088;

        http.listen(port, function(){
          console.log('listening on *:' +port);
          
        });
    }
    function cb_invoked(e, a){
        console.log('response: ', e, a);
    }


//-----------------------------------------------------------------------------------------------------
//-----------------API FOR Second-hand car PROD--------------------------------------------------------
    app.post('/GetTimeline', function(req, res){
        var carID = req.body.CAR_ID;
        
        console.log('got GetTimeline request');
        g_cc.query.GetTimeline([carID],function(err,resp){
             if(!err){
                var pre = JSON.parse(resp);
                if (pre.EVENTS == null){
                    res.json({
                        "respond":401,
                        "content":null
                    });
                    return;
                }
                res.json({
                    "respond":300,
                    "content":pre.EVENTS
                });
                console.log('success',pre);  
            }else{
                console.log('fail');
            }
        });
    });

    app.post('/GetInsuranceEvent', function(req, res){
        var carID = req.body.CAR_ID;
        
        console.log('got GetInsuranceEvent request');
        g_cc.query.GetInsuranceEvent([carID],function(err,resp){
             if(!err){
                var pre = JSON.parse(resp);
                if (pre.EVENTS == null){
                    res.json({
                        "respond":401,
                        "content":null
                    });
                    return;
                }
                res.json({
                    "respond":300,
                    "content":pre.EVENTS
                });
                console.log('success',pre);  
            }else{
                console.log('fail');
            }
        });
    });

    app.post('/PutEvent', function(req, res){
        var id = req.body.ID;
        var id_car = req.body.ID_CAR;
        var owner = req.body.OWNER;
        var day_code = req.body.DAY_CODE;
        var location = req.body.LOCATION;
        var image = req.body.IMAGE;
        var describe = req.body.DESCRIBE;
        var iot = req.body.IOT;
        
        console.log('got PutEvent request');
        g_cc.invoke.PutEvent([id,id_car,owner,day_code,location,image,describe,iot],function(err,resp){
            var ss = resp;
            res.json({
                "msg":ss,
                "record_id":id
            });
            console.log('success',ss);
        });
    });


//-------------------------------------------------------------------------------------
//-----------------API FOR DEV--------------------------------------------------------

    app.get('/chain_stats', function(req, res){
        console.log('got stat request');
        ibc.chain_stats(function(e, stats){
            console.log('got some stats', stats);
            res.json({"stat": stats});              
        });
    });
    app.get('/deploy', function(req, res){
        console.log('got deploy request');
        g_cc.deploy('init', ['99'],function(){
            console.log('success deploy');
            res.json({"stat": "success deploy"});              
        });
    });

    app.post('/read',function(req,res){
        var key = req.body.KEY;

        console.log('got a read request');
        g_cc.query.read([key],function(err,resp){
            res.json(resp);
        });
    });
    app.post('/write',function(req,res){
        var key = req.body.KEY;
        var arg = req.body.ARG;
        console.log('got a write request');
        g_cc.invoke.write([key,arg],function(err,resp){
            var ss = resp;
            res.json({
                "msg":ss
            });
            console.log('success',ss);
        });
    });

    app.post('/writeMarble',function(req,res){
        var name = req.body.NAME;
        console.log('got a write request');
        g_cc.invoke.init_marble([name],function(err,resp){
            var ss = resp;
            res.json({
                "msg":ss
            });
            console.log('success',ss);
        });
    });
    app.post('/writeTrade',function(req,res){

        console.log('got a write request');
        g_cc.invoke.open_trade(["bob", "blue", "16", "red", "16"],function(err,resp){
            var ss = resp;
            res.json({
                "msg":ss
            });
            console.log('success',ss);
        });
    });
    
    function padZ(s){
        if (s.toString().length ==1){
            return '0'+s;   
        }
        return s;
    }
    
