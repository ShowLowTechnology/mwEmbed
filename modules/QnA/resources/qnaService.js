/*
DAL for Q&A Module


 */

(function (mw, $) {
    "use strict";

    var viewedEntries=(function() {
        var _viewedEntries = [];
        if (localStorage["_viewedEntries"]) {
            _viewedEntries = JSON.parse(localStorage["_viewedEntries"]);
        }
        return {
            markAsRead: function(EntryId) {
                // Write to localStorage this item was read
                if (_viewedEntries.indexOf(EntryId) < 0 ) {
                    _viewedEntries.push(EntryId);
                    localStorage["_viewedEntries"] = JSON.stringify(_viewedEntries);

                }
            },
            isRead: function(EntryId) {
                return _viewedEntries.indexOf(EntryId) > -1;
            },
            readThreadsCount: function() {
                return _viewedEntries.length;
            }
        };
    })();

    function QnaThread(ThreadId){
        var _this = this;
        _this.ThreadID = ThreadId;
        _this.entries = ko.observableArray();

        this.getThreadID = function(){
            return _this.ThreadID;
        };

        this.isRead = ko.observable(viewedEntries.isRead(_this.ThreadID));
        this.isCollapsed = ko.observable(true);
        this.appendEntry = function(entry){
            entry.setThread(_this);
            if (!_this.isCollapsed()) {
                _this.entries.push(ko.observable(entry));
            }
            else{
                _this.entries.unshift(ko.observable(entry));
            }
        };

        this.hasUnreadEntries = ko.computed(function() {
            for (var i = 0; i < _this.entries().length; i++) {
                if(!_this.entries()[i]().isRead()){
                    return true;
                }
            }
            return false;
        });
    };

    function QnaEntry(cuePoint){

        var _this = this;

        this.cuePoint=ko.observable(cuePoint);
        this.timestamp = ko.observable(this.cuePoint().createdAt);

        this.getType = function(){
            return this.cuePoint().metadata.Type;
        };

        this.isRead = ko.observable(viewedEntries.isRead(_this.cuePoint().id) || _this.getType() === "Question");

        this.setThread = function(thread){
            this._thread = thread;
        };

        this.getThread = function(){
            return this._thread;
        };

        this.getContent = function(){
            return this.cuePoint().text;
        };

        this.getTime = function(){
            return this.cuePoint().createdAt;
        };

        this.getOwner = function(){
            return this.cuePoint().userId;
        };

        this.getThreadID = function(){
            return this.cuePoint().metadata.ThreadId;
        };

        this.isAnnouncement = function(){
            return this.type === "Announcement";
        };

        this.getTitle = function(){
            if (this.getType() === "Announcement"){
                return gM('qna-announcement-title');
            }
            else if (this.getType() === "Question"){
                return gM('qna-you-asked');
            }
            else{
                return gM('qna-answered-by') + " " + this.cuePoint().userId;
            }
        };

        this.getText = function(){
            return this.cuePoint().text;
        };

        this.getCurrentTime = function(){
            return this.currentTime;
        };
    }


    mw.KQnaService = function (embedPlayer,qnaPlugin) {
        return this.init(embedPlayer,qnaPlugin);
    };

    mw.KQnaService.prototype = {

        // The bind postfix:
        bindPostfix: '.KQnaService',
        liveAQnaIntervalId: null,
        QnaThreads: ko.observableArray(),
        lastUpdateTime: -1,
        QandA_ResponseProfile: "QandA_ResponseProfile",
        QandA_ResponseProfileSystemName: "QandA",
        QandA_MetadataProfileSystemName: "QandA",
        QandA_cuePointTag: "qna",
        useResponseProfile: true,
        QandA_cuePointTypes: {"Question":1,"Answer":2, "Announcement":3},
        bootPromise:null,


        init: function (embedPlayer, qnaPlugin) {
            var _this = this;
            // Remove any old bindings:
            this.destroy();
            // Setup player ref:
            this.embedPlayer = embedPlayer;
            this.qnaPlugin = qnaPlugin;

            this.requestCuePoints();

            if (embedPlayer.isLive()) {
                this.registerItemNotification();
            }

        },

        viewedEntries: viewedEntries,

        destroy: function () {

            if (this.liveAQnaIntervalId) {
                clearInterval(this.liveAQnaIntervalId);
                this.liveAQnaIntervalId = null;
            }
            $(this.embedPlayer).unbind(this.bindPostfix);
        },

        getKClient: function () {
            if (!this.kClient) {
                this.kClient = mw.kApiGetPartnerClient(this.embedPlayer.kwidgetid);
            }
            return this.kClient;
        },

        //returns questions, answers and announcement
        getQnaThreads: function () {
            return this.QnaThreads;
        },

        createMetadataXmlFromObject: function (obj) {
            var xml = "<metadata>";
            for (var propertyName in obj) {
                xml += "<" + propertyName + ">" + obj[propertyName] + "</" + propertyName + ">";
            }
            xml += "</metadata>";
            return xml;
        },

        submitQuestion: function (question, parent) {

            var embedPlayer = this.embedPlayer;
            var _this = this;

            var startTime = new Date();

            var metadata= { };
            if (parent) {
                metadata.ThreadId = parent.metadata.ThreadId;
                metadata.Type="Answer";
            } else {
                //no threadid!
                metadata.Type="Question";
            }

            var xmlData = _this.createMetadataXmlFromObject(metadata);


            var createCuePointRequest = {
                "service": "cuePoint_cuePoint",
                "action": "add",
                "cuePoint:objectType": "KalturaAnnotation",
                "cuePoint:entryId": embedPlayer.kentryid,
                "cuePoint:startTime": embedPlayer.currentTime,
                "cuePoint:text": question,
                "cuePoint:tags": this.QandA_cuePointTag,
                "cuePoint:partnerData": xmlData
            };
            if (parent) {
                createCuePointRequest["cuePoint:parentId"] = parent.id;
            }

            var listMetadataProfileRequest = {
                service: "metadata_metadataprofile",
                action: "list",
                "filter:systemNameEqual": this.QandA_MetadataProfileSystemName
            };
            var addMetadataRequest = {
                service: "metadata_metadata",
                action: "add",
                metadataProfileId: "{2:result:objects:0:id}",
                objectId: "{1:result:id}",
                xmlData: xmlData,
                objectType: "annotationMetadata.Annotation"
            };


            // mw.log("Submitting a new question: " + question);

            _this.getKClient().doRequest([createCuePointRequest, listMetadataProfileRequest, addMetadataRequest], function (result) {
                    var endTime = new Date();
                    var cuePoint = result[0];
                    var metadata = result[2];
                    if (cuePoint.id) {


                        var item=_this.annotationCuePointToQnaEntry(cuePoint);

                        if (item) {

                            _this.addOrUpdateEntry(item);
                        }
                        mw.log("added Annotation cue point with id: " + cuePoint.id + " took " + (endTime - startTime) + " ms");


                    } else {
                        mw.log("error adding Annotation " + JSON.stringify(cuePoint));

                    }
                },
                false,
                function (err) {
                    mw.log("Error: " + this.bindPostfix + " could not add cue point. Error: " + err);
                });
        },

        // item can be either a QnaThread (for an announcement) or a QnaEntry (for a Q&A thread)
        markAsRead: function (item) {

            item.isRead(true);
            if (item.entries !== undefined){
                item.entries()[0]().isRead(true);
                viewedEntries.markAsRead(item.ThreadID);
                this.updateThread(item);
            }
            else{
                viewedEntries.markAsRead(item.cuePoint().id);
                this.addOrUpdateEntry(item);
            }
        },

        readThreadsCount: function () {
            return viewedEntries.readThreadsCount();
        },

        updateThread: function(qnaThread){
            var _this=this;
            for (var i = 0; i < _this.QnaThreads().length; i++) {
                if (_this.QnaThreads()[i]().getThreadID() === qnaThread.ThreadID){
                    _this.qnaPlugin.updateUnreadBadge();
                    break;
                }
            }
        },

        // look for a QnaThread for this QnaEntry
        // if we don't find on we will create it
        addOrUpdateEntry: function (qnaEntry) {

            var _this=this;
            var found = false;

            for (var i = 0; i < _this.QnaThreads().length; i++) {

                if (_this.QnaThreads()[i]().getThreadID() === qnaEntry.getThreadID())
                {
                    // look it this entry exists. If so replace it
                    for (var j = 0; j < _this.QnaThreads()[i]().entries().length; j++){
                        if (_this.QnaThreads()[i]().entries()[j]().cuePoint().id === qnaEntry.cuePoint().id){
                            qnaEntry.setThread(_this.QnaThreads()[i]());
                            _this.QnaThreads()[i]().entries.splice(j, 0, ko.observable(qnaEntry));
                            _this.QnaThreads()[i]().entries.splice(j+1, 1);
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        _this.QnaThreads()[i]().appendEntry(qnaEntry);
                    }

                    if (!found) {
                        _this.QnaThreads.unshift(_this.QnaThreads()[i]);
                        _this.QnaThreads.splice(i + 1, 1);
                    }
                    found = true;
                    break;

                    //var tmp = _this.QnaThreads()[i];
                    ////_this.QnaThreads.splice(i, 0, _this.QnaThreads()[i]);
                    ////
                    //_this.QnaThreads.splice(i, 1);
                    //_this.QnaThreads.unshift(tmp);

                }
            }

            if (!found) {
                var newThread = new QnaThread(qnaEntry.getThreadID());
                newThread.appendEntry(qnaEntry);
                _this.QnaThreads.unshift(ko.observable(newThread));
            }

            _this.qnaPlugin.updateUnreadBadge();
        },

        metadataToObject: function(metadata) {
            var xml = $.parseXML(metadata.xml);

            var $xml = $( xml ).find('metadata').children();

            var obj={};
            $.each( $xml, function(inx, node){
                if (node.nodeType===1) {
                    obj[node.nodeName] = node.textContent;
                }
            });
            obj['xml'] = metadata.xml;
            return obj;
        },

        joinMetadataWithCuepoint:function(cuePoint,metadata ){
            if (!metadata)
                return false;

            var obj=this.metadataToObject(metadata);

            delete cuePoint.relatedObjects;

            $.extend(cuePoint,{ metadata: obj, metadataId: metadata.id});

            return true;

        },

        // convert a cuePoint from the server to a QnaEntry object
        annotationCuePointToQnaEntry: function(cuePoint) {

            var metadata=cuePoint.metadata;
            if (cuePoint.relatedObjects &&
                cuePoint.relatedObjects[this.QandA_ResponseProfile] &&
                cuePoint.relatedObjects[this.QandA_ResponseProfile].objects &&
                cuePoint.relatedObjects[this.QandA_ResponseProfile].objects.length>0) {

                metadata=cuePoint.relatedObjects[this.QandA_ResponseProfile].objects[0];

                delete cuePoint.relatedObjects;
            }

            if (!cuePoint.metadata) {

                metadata={ xml: cuePoint.partnerData, id: null };
            }

            if (!this.joinMetadataWithCuepoint(cuePoint,metadata)) {
                mw.log("Cue point "+cuePoint.id+ " was ignored since it's not a valid one" );
                return null;
            }

            if (!cuePoint.metadata.ThreadId) {
                //take the thread id from cue point id
                cuePoint.metadata.ThreadId=cuePoint.id;
            }

            var tempType=this.QandA_cuePointTypes[cuePoint.metadata.Type];

            return new QnaEntry(cuePoint);
        },

        boot:function() {

            if (this.bootPromise) {
                return this.bootPromise;
            }

            var _this=this;

            var deferred = $.Deferred();
            var listMetadataProfileRequest = {
                service: "metadata_metadataprofile",
                action: "list",
                "filter:systemNameEqual": this.QandA_MetadataProfileSystemName
            };
            var getCurrentUser = {
                service: "session",
                action: "get"
            };

            this.getKClient().doRequest([listMetadataProfileRequest,getCurrentUser], function (result) {
                _this.metadataProfile = result[0].objects[0];
                _this.userId=result[1].userId;

                deferred.resolve();
            });

            this.bootPromise=deferred;
            return this.bootPromise;
        },

        requestCuePoints:function() {
            var _this = this;



            this.boot().then(function() {

                var entryId = _this.embedPlayer.kentryid;

                //we want to search all cuepoints assigned to me (IsPublic=true,and metadata field assigned to contains my user),
                // public announcements  (IsPublic=true), which no-one is assigned to
                //and cue points that I created
                var request = {
                    'service': 'cuepoint_cuepoint',
                    'action': 'list',
                    'filter:tagsLike': _this.QandA_cuePointTag,
                    'filter:entryIdEqual': entryId,
                    'filter:objectType': 'KalturaAnnotationFilter',
                    'filter:orderBy': '+createdAt',
/*
                    'filter:advancedSearch:objectType': 'KalturaMetadataSearchItem',
                    'filter:advancedSearch:metadataProfileId': _this.metadataProfile.id,
                    'filter:advancedSearch:type': 2, //or
                    //search all ones that i'm assigned to
                    'filter:advancedSearch:items:item0:objectType': "KalturaSearchCondition",
                    'filter:advancedSearch:items:item0:field': "/*[local-name()='metadata']/*[local-name()='Assignees']",
                    'filter:advancedSearch:items:item0:value': _this.userId,
                    */
                };

                if (_this.useResponseProfile) {
                    request["responseProfile:objectType"] = "KalturaResponseProfileHolder";
                    request["responseProfile:systemName"] = _this.QandA_ResponseProfileSystemName;
                }
                var lastUpdatedAt = _this.lastUpdateTime + 1;
                // Only add lastUpdatedAt filter if any cue points already received
                if (lastUpdatedAt > 0) {
                    request['filter:updatedAtGreaterThanOrEqual'] = lastUpdatedAt;
                }
                _this.getKClient().doRequest(request,
                    function (data) {
                        // if an error pop out:
                        if (!data || data.code) {
                            // todo: add error handling
                            mw.log("Error:: KCuePoints could not retrieve live cuepoints");
                            return;
                        }

                        data.objects.forEach(function (cuePoint) {

                            var item = _this.annotationCuePointToQnaEntry(cuePoint);

                            if (item) {

                                if (_this.lastUpdateTime < cuePoint.updatedAt) {
                                    _this.lastUpdateTime = cuePoint.updatedAt;
                                }
                                _this.addOrUpdateEntry(item);
                            }
                        });
                    }
                );
            });
        },

        //Currently there is no notification, so we poll the API
        registerItemNotification: function () {
            var _this = this;

            //Start live cuepoint pulling
            this.liveAQnaIntervalId = setInterval(function () {
                _this.requestCuePoints();
            }, mw.getConfig("qnaPollingInterval") || 10000);
        }
    };
})(window.mw, window.jQuery);
