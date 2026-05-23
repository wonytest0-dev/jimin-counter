const fs=require("fs");
const axios=require("axios");
const {chromium}=require("playwright");

const ARTIST_ID="1oSPZhvZMIrWW5I41kPkkY";
const ARTIST_URI=`spotify:artist:${ARTIST_ID}`;
const SENTINEL_SONG="Who";

const SNAPSHOT_FILE="spotify-snapshot.json";
const HISTORY_FILE="spotify-history.json";
const COUNTER_FILE="counter.json";

const DISCOGRAPHY_HASH="5e07d323febb57b4a56a42abbf781490e58764aa45feb6e3dc0591564fc56599";
const TRACKS_HASH="b9bfabef66ed756e5e13f68a942deb60bd4125ec1f1be8cc42769dc0259b4b10";

function formatNumber(num){
if(!num)return"0";

if(num>=1_000_000_000){
return((num/1_000_000_000).toFixed(2).replace(/\.00$/,""))+"B";
}

if(num>=1_000_000){
return((num/1_000_000).toFixed(1).replace(/\.0$/,""))+"M";
}

if(num>=1000){
return((num/1000).toFixed(1).replace(/\.0$/,""))+"K";
}

return num.toString();
}

function readJSON(path,fallback=null){
try{

if(fs.existsSync(path)){
return JSON.parse(
fs.readFileSync(path,"utf8")
);
}

return fallback;

}catch{
return fallback;
}
}

function saveJSON(path,data){
fs.writeFileSync(
path,
JSON.stringify(data,null,2)
);
}

function getTodayDate(){
return new Date().toLocaleDateString(
"en-CA",
{
timeZone:"Asia/Jakarta"
}
);
}

async function getSpotifyAuth(){

const browser=
await chromium.launch({
headless:true
});

const context=
await browser.newContext({
storageState:
"./spotify-login.json"
});

const page=
await context.newPage();

let authToken="";
let clientToken="";

page.on(
"request",
request=>{

if(
request.url().includes(
"api-partner.spotify.com"
)
){

const headers=
request.headers();

const auth=
headers["authorization"];

const client=
headers["client-token"];

if(auth?.startsWith("Bearer")){
authToken=auth;
}

if(client){
clientToken=client;
}

}

}
);

console.log(
"🌐 opening spotify..."
);

await page.goto(
"https://open.spotify.com",
{
waitUntil:
"domcontentloaded"
}
);

await page.waitForTimeout(
5000
);

console.log(
"🎧 opening artist..."
);

await page.goto(
`https://open.spotify.com/artist/${ARTIST_ID}`,
{
waitUntil:
"networkidle"
}
);

await page.waitForTimeout(
8000
);

await browser.close();

return{
authToken,
clientToken
};

}

async function spotifyQuery(
authToken,
clientToken,
operationName,
variables,
hash
){

const response=
await axios.post(
"https://api-partner.spotify.com/pathfinder/v2/query",
{
operationName,
variables,
extensions:{
persistedQuery:{
version:1,
sha256Hash:hash
}
}
},
{
headers:{
accept:"application/json",
authorization:authToken,
"client-token":clientToken,
"app-platform":"WebPlayer",
"content-type":"application/json",
origin:"https://open.spotify.com",
referer:"https://open.spotify.com/",
"spotify-app-version":"1.2.91.173.g0dd46a9b",
"user-agent":"Mozilla/5.0"
}
}
);

return response.data;
}

async function getAllReleases(
authToken,
clientToken
){

const discography=
await spotifyQuery(
authToken,
clientToken,
"queryArtistDiscographyAll",
{
uri:ARTIST_URI,
offset:0,
limit:100,
order:"DATE_DESC"
},
DISCOGRAPHY_HASH
);

return(
discography
?.data
?.artistUnion
?.discography
?.all
?.items
?.flatMap(
item=>
item.releases.items
)||[]
);

}

async function getReleaseTracks(
authToken,
clientToken,
release
){

const data=
await spotifyQuery(
authToken,
clientToken,
"queryAlbumTracks",
{
uri:release.uri,
offset:0,
limit:300
},
TRACKS_HASH
);

return(
data
?.data
?.albumUnion
?.tracksV2
?.items
?.map(
item=>({

title:item.track.name,

streams:Number(
item.track.playcount||0
),

trackId:
item.track.uri
.split(":")[2],

release:
release.name,

releaseType:
release.type,

image:
release.coverArt
?.sources?.[0]
?.url||null

})
)||[]
);

}

async function getArtistStats(
authToken,
clientToken
){

const data=
await spotifyQuery(
authToken,
clientToken,
"queryNpvArtist",
{
artistUri:ARTIST_URI,
trackUri:"spotify:track:7tI8dRuH2Yc6RuoTjxo4dU",
contributorsLimit:10,
contributorsOffset:0,
enableRelatedVideos:false,
enableRelatedAudioTracks:false
},
"b2cedf7ed0f29c713567d97ed69b848c8387294edfe58a0e439a3a5669cc27bb"
);

return(
data
?.data
?.artistUnion
?.stats||{}
);

}

function getSentinelSong(
songs
){

return songs.find(
song=>

song.title
.trim()
.toLowerCase()
===
SENTINEL_SONG
.toLowerCase()

&&

song.release
===
"MUSE"

);

}

function getPreviousSong(
snapshot,
title
){

return(
snapshot
?.songs
?.find(
song=>
song.title===
title
)||null
);

}

async function generateCounter(){

try{

console.log(
"🔥 getting spotify auth..."
);

const{
authToken,
clientToken
}=
await getSpotifyAuth();

if(!authToken){
throw new Error(
"No Spotify auth token found"
);
}

if(!clientToken){
throw new Error(
"No client token found"
);
}

console.log(
"✅ auth found"
);

console.log(
"👀 checking Who..."
);

const museRelease={
uri:"spotify:album:15XcLhiVMlSOipUddTNDnr",
name:"MUSE",
type:"ALBUM",
coverArt:{
sources:[]
}
};

const whoTracks=
await getReleaseTracks(
authToken,
clientToken,
museRelease
);

const sentinelSong=
whoTracks.find(
track=>

track.title
.trim()
.toLowerCase()
===
SENTINEL_SONG
.toLowerCase()

&&

track.release
===
"MUSE"

);

if(!sentinelSong){
throw new Error(
"Who not found"
);
}

const snapshot=
readJSON(
SNAPSHOT_FILE
);

const history=
readJSON(
HISTORY_FILE,
[]
);

const previousWho=
snapshot
?.sentinel
?.streams
??0;

const currentWho=
sentinelSong
?.streams
??0;

if(
previousWho
===
currentWho
){

console.log(
`⏸ Who unchanged:
${currentWho}`
);

return;
}

console.log(
`🚀 Who updated:
${previousWho}
→
${currentWho}`
);

const artistStats=
await getArtistStats(
authToken,
clientToken
);

const releases=
await getAllReleases(
authToken,
clientToken
);

let allSongs=[];

for(
const release
of releases
){

console.log(
`🎧 ${release.name}`
);

const tracks=
await getReleaseTracks(
authToken,
clientToken,
release
);

allSongs.push(
...tracks
);

}

const processedSongs=
allSongs.map(
song=>{

const previous=
getPreviousSong(
snapshot,
song.title
);

const previousStreams=
previous
?.streams
||
song.streams;

const dailyGain=
song.streams-
previousStreams;

const yesterdayGain=
previous
?.dailyGain
||0;

const gainDifference=
dailyGain-
yesterdayGain;

return{

...song,
previousStreams,
dailyGain,
yesterdayGain,
gainDifference,

formattedStreams:
formatNumber(
song.streams
),

formattedDailyGain:
dailyGain>0
? `+${formatNumber(
dailyGain
)}`
: "0",

formattedGainDifference:
gainDifference>0
? `+${formatNumber(
gainDifference
)}`
: formatNumber(
gainDifference
)

};

}
);

const songMap=
new Map();

processedSongs.forEach(
song=>{

const key=
`${song.streams}-${song.dailyGain}`;

const existing=
songMap.get(
key
);

if(
!existing||
song.streams>
existing.streams
){

songMap.set(
key,
song
);

}

}
);

const uniqueSongs=
Array.from(
songMap.values()
);

const totalDailyGain=
uniqueSongs.reduce(
(sum,song)=>
sum+
(song.dailyGain||0),
0
);

const previousHistory=
history[
history.length-1
];

const previousTotal=
previousHistory
?.totalStreams
||0;

const totalStreams=
previousTotal+
totalDailyGain;

const sortedSongs=
uniqueSongs.sort(
(a,b)=>
b.streams-
a.streams
);

const releaseMap=
new Map();

sortedSongs.forEach(
song=>{

const key=
song.release;

if(
!releaseMap.has(
key
)
){

releaseMap.set(
key,
{
title:
song.release,
type:
song.releaseType,
image:
song.image,
streams:0,
dailyGain:0,
songs:[]
}
);

}

const release=
releaseMap.get(
key
);

release.streams+=
song.streams||0;

release.dailyGain+=
song.dailyGain||0;

release.songs.push(
song
);

}
);


