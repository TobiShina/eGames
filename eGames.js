//******************************main JS for WWE leaderboard*/
function SelectAllData(){
    firebase.database().ref('wwe').on('value',
    function(AllRecordsz){
        AllRecordsz.forEach(
            function(CurrentRecordz){
                var gamersz = CurrentRecordz.val().gameru;
                var playedz = CurrentRecordz.val().played;
                var winsz = CurrentRecordz.val().wins;
                
                
                AddItemsToTable(gamersz,playedz,winsz,);
                
            }
        );
    }
    );
}

window.onload = SelectAllData ;

//*******************filling the table */
var gamerNoz = 0;
function AddItemsToTable(gamersz,playedz,winsz){
    var tbodyz = document.getElementById('tbody1');
    var trowz = document.createElement('tr');
    var td1z = document.createElement('td');
    var td2z = document.createElement('td');
    var td3z = document.createElement('td');
    var td4z = document.createElement('td');
    
    td1z.innerHTML = ++gamerNoz;
    td2z.innerHTML = gamersz;
    td3z.innerHTML = playedz;
    td4z.innerHTML = winsz;
    
    trowz.appendChild(td1z); 
    trowz.appendChild(td2z); 
    trowz.appendChild(td3z); 
    trowz.appendChild(td4z);
    
    tbodyz.appendChild(trowz);



}


//******************************main JS for FIFA leaderboard*/
function SelectAllDataFromFire(){
    firebase.database().ref('1').once('value',
    function(AllRecords){
        AllRecords.forEach(
            function(CurrentRecord){
                var gamerzf = CurrentRecord.val().gamer;
                var winzf = CurrentRecord.val().win;
                var losezf = CurrentRecord.val().lose;
                var goalszf = CurrentRecord.val().goals;
                
                AddThemItemsToTable(gamerzf,winzf,losezf,goalszf,);
                
            }
        );
    }
    );
}

window.onload = SelectAllDataFromFire ;

//*******************filling the table */
var gamerNof = 0;
function AddThemItemsToTable(gamerzf,winzf,losezf,goalszf){
    var tbody = document.getElementById('tbody2');
    var trow = document.createElement('tr');
    var td1 = document.createElement('td');
    var td2 = document.createElement('td');
    var td3 = document.createElement('td');
    var td4 = document.createElement('td');
    var td5 = document.createElement('td');
    td1.innerHTML = ++gamerNof;
    td2.innerHTML = gamerzf;
    td3.innerHTML = winzf;
    td4.innerHTML = losezf;
    td5.innerHTML = goalszf;
    trow.appendChild(td1); 
    trow.appendChild(td2); 
    trow.appendChild(td3); 
    trow.appendChild(td4);
    trow.appendChild(td5);
    tbody.appendChild(trow);



}

//**************************join eGames */
let NameT = document.getElementById('NameTbox');
let RollT = document.getElementById('RollTbox');
let SecT = document.getElementById('SecTbox');
let GenT = document.getElementById('GenTbox');

let nameV, rollV, secV, genV; 

function Update(val,type){
    if(type=='name') nameV=val;
    else if(type=='roll') rollV=val;
    else if(type=='sec') secV=val;
    else if(type=='gen') genV=val;
}
//***************************Writing Data *//
let cloudDB = firebase.firestore();
//***************************Add document with Auto Generated ID *//
function Add_Doc_WithAutoID(){
    
      cloudDB.collection("students").add(
          {
              NameOfStd: nameV,
              RollNo: Number(rollV),
              Section: secV,
              Gender: genV
          }
      )
      .then(function (docRef){
          console.log("Document written with ID", docRef.id);
      })
      .catch(function(error){
          console.error("Error addidng document", error);
      });
}

//***************************Add document with Custom ID *//
function Add_Doc_WithID(){
    
    cloudDB.collection("wrestlers").doc(rollV).set(
        {
            NameOfStd: nameV,
            RollNo: Number(rollV),
            Section: secV,
            Gender: genV
        }
    )
    .then(function (){
        console.log("Document written with ID", rollV);
    })
    .catch(function(error){
        console.error("Error addidng document", error);
    });
}
//***************************Button Events *//

document.getElementById('insertBtn').onclick=function(){
    Add_Doc_WithID();
}

document.getElementById('selectBtn').onclick=function(){

}

document.getElementById('updateBtn').onclick=function(){

}

document.getElementById('deleteBtn').onclick=function(){

}