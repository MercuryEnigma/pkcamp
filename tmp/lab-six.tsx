import React from 'react'
import {createRoot} from 'react-dom/client'
import {LabMain} from '../src/pages/pokestorage/lab/LabMain'
import {PkHexContext} from '../src/pages/context/PkHexContext'
import {saveUploadedCollections} from '../src/pages/pokestorage/lab/labStore'
import {MemoryFileStore,FileStoreProvider,storage} from '../src/services/storage'
import {dropboxAccount} from '../src/services/storage/dropbox'
import '../src/index.css'
import '../src/App.css'
await dropboxAccount.initialize()
storage.use(new FileStoreProvider(new MemoryFileStore(),{id:'local',label:'Test browser'}))
saveUploadedCollections(Array.from({length:4},(_,index)=>({schemaVersion:'1',id:`test-${index}`,name:`Test Collection ${index+1}`,metadata:{version:'1'},groups:[],pokemon:{bulbasaur:{species:1}}})))
createRoot(document.getElementById('root')!).render(<PkHexContext.Provider value={{adapter:null,loading:false,error:null}}><LabMain onBack={()=>{}} /></PkHexContext.Provider>)
