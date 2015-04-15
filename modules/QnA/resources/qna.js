(function (mw, $) {
	"use strict";

	mw.PluginManager.add('qna', mw.KBasePlugin.extend({

		defaultConfig: {
			templatePath: '../QnA/resources/qna.tmpl.html',
			cssFileName: 'modules/QnA/resources/qna.css'
		},

		getBaseConfig: function() {
			var parentConfig = this._super();
			return $.extend({}, parentConfig, {
				qnaTargetId: null
			});
		},

		setup: function () {
			this.addBindings();
		},

		addBindings: function () {
			var _this = this;
			var embedPlayer = this.getPlayer();

			this.bind('layoutBuildDone', function (event, screenName) {
				// add the Q&A toggle button to be on the video
				embedPlayer.getVideoHolder().append('<div class="qna-on-video-btn icon-qna-close"></div>');
				_this.getQnaContainer();
				var qnaObject =  $(window['parent'].document.getElementById(embedPlayer.id )).parent().find( ".qnaInterface" );
				var onVideoTogglePluginButton = $('.qna-on-video-btn');
				// register to on click to change the icon of the toggle button
				$(".qna-on-video-btn").on("click", function(){
					if (qnaObject.is(":visible")){
						qnaObject.hide();
						onVideoTogglePluginButton.removeClass('icon-qna-close');
						onVideoTogglePluginButton.addClass('icon-qna-Ask');
					} else {
						qnaObject.show();
						onVideoTogglePluginButton.removeClass('icon-qna-Ask');
						onVideoTogglePluginButton.addClass('icon-qna-close');
					}
				})

				//update display - commented out since it make it hard to debug stuff
				setInterval(function(){
					_this.getQnaContainer();
				}, 10000);
			});

			this.bind('onOpenFullScreen', function() {
				$(".qna-on-video-btn").hide();
			});
			this.bind('onCloseFullScreen', function() {
				$(".qna-on-video-btn").show();
			});
		},

		// Create a cue-point in the server for the question
		submitQuestion: function(question){
			var embedPlayer = this.getPlayer();
			var _this = this;

			var entryRequest = {
				"service": "cuePoint_cuePoint",
				"action": "add",
				"cuePoint:objectType": "KalturaAnnotation",
				"cuePoint:entryId": embedPlayer.kentryid,
				"cuePoint:startTime": embedPlayer.currentTime,
				"cuePoint:text": question,
				"cuePoint:tags": "qna"
			};

			_this.getKClient().doRequest(entryRequest, function (result) {
				mw.log("added Annotation cue point with id: " + result.id);
			},
			false,
			function(err){
				mw.log( "Error: "+ this.pluginName +" could not add cue point. Error: " + err );
			});
		},

		getKClient: function () {
			if (!this.kClient) {
				this.kClient = mw.kApiGetPartnerClient(this.embedPlayer.kwidgetid);
			}
			return this.kClient;
		},

		// load the Q&A template to the div with qnaTargetId
		getQnaContainer: function(){
			if (!this.$qnaListContainer) {
				// Inject external CSS file
				var cssLink = this.getConfig('cssFileName');
				if (cssLink) {
					cssLink = cssLink.toLowerCase().indexOf("http") === 0 ? cssLink : kWidget.getPath() + cssLink; // support external CSS links
					$('head', window.parent.document).append('<link type="text/css" rel="stylesheet" href="' + cssLink + '"/>');
				} else {
					mw.log("Error: " + this.pluginName + " could not find CSS link");
				}

				var iframeParent = window['parent'].document.getElementById(this.embedPlayer.id);
				$(iframeParent).parent().find("#" + this.getConfig('qnaTargetId')).html("<div class='qnaInterface'></div>");
				this.$qnaListContainer = $(iframeParent).parent().find(".qnaInterface");
			}
			var elem = this.$qnaListContainer.find(".qnaModuleBackground");

			// call getHTML before we remove the element since we get some data from the existing one
			var newHtml = this.getHTML();
			if (elem.length > 0){
				(elem[0]).remove();
			}

			this.$qnaListContainer.append(newHtml);

			// if we did not remove anything this is the first time, so do the reset
			// otherwise the text was generated there from last text
			this.bindButtons(elem.length === 0);
			this.positionOnVideoButton();

			return this.$qnaListContainer;
		},

		positionOnVideoButton : function(){
			var onVideoTogglePluginButton = $('.qna-on-video-btn');
			var videoHeight = this.getPlayer().getHeight();
			var buttonHeight = Math.round(videoHeight / 5);
			var buttonWidth = Math.round(videoHeight / 10);
			onVideoTogglePluginButton.css({height: buttonHeight + "px"});
			onVideoTogglePluginButton.css({width: buttonWidth + "px"});

			var borderRadius = buttonWidth + "px 0 0 " + buttonWidth + "px";
			onVideoTogglePluginButton.css({'-moz-border-radius': borderRadius});
			onVideoTogglePluginButton.css({'-webkit-border-radius': borderRadius});
			onVideoTogglePluginButton.css({'border-radius': borderRadius});

			var topOffset = (videoHeight-onVideoTogglePluginButton.height())/2 + "px";
			onVideoTogglePluginButton.css({top: topOffset});

			onVideoTogglePluginButton.css({'line-height': buttonHeight + "px"});

			var textIndent = (buttonWidth - parseInt(onVideoTogglePluginButton.css('font-size'))) / 2;
			onVideoTogglePluginButton.css({'text-indent': textIndent + "px"});

		},

		bindButtons : function(resetTextArea){
			resetTextArea = typeof resetTextArea !== 'undefined' ? resetTextArea : true;
			var _this = this;
			var parentWindowDocument = $( window['parent'].document );
			var sendButton = parentWindowDocument.find('.qnaSendButton');
			sendButton.text(gM('qna-send-button-text'));
			sendButton
				.off('click')
				.on('click', function(){
					var question = parentWindowDocument.find('.qnaQuestionTextArea').val();
					if (_this.getPlayer().isOffline()){
						alert(gM('qna-cant-ask-while-not-live'));
					} else {
						if (question !== gM('qna-default-question-box-text')) {
							_this.submitQuestion(question);
							_this.resetTextArea(textArea);
						}
					}
				});
			var cancelButton = parentWindowDocument.find('.qnaCancelButton');
			cancelButton.text(gM('qna-cancel-button-text'));
			cancelButton
				.off('click')
				.on('click', function(){
					_this.resetTextArea(textArea);
				});

			var textArea = parentWindowDocument.find('.qnaQuestionTextArea');
			if (resetTextArea) {
				_this.resetTextArea(textArea);
			}
			textArea
				.off('focus')
				.on('focus', function(){
					if (textArea.val() === gM('qna-default-question-box-text')) {
						textArea.css({'font-weight': 300});
						textArea.val('');
						textArea.css({'color': '#ffffff'});
					}
				});

			textArea
				.off('blur')
				.on('blur', function(){
					if (textArea.val() === '') {
						_this.resetTextArea(textArea);
					}
				});

			textArea.bind("mousewheel",function(ev) {
				ev.preventDefault();
				var scrollTop = $(this).scrollTop();
				$(this).scrollTop(scrollTop-Math.round(ev.originalEvent.deltaY));
			});
		},

		resetTextArea : function(textArea){

			textArea.val(gM('qna-default-question-box-text'));
			textArea.css({'font-weight': 300});
			textArea.css({'color': 'rgba(255, 240, 240, 0.61)'});
		},

		getHTML : function(data){
			var templatePath = this.getConfig( 'templatePath' );
			var rawHTML = window.kalturaIframePackageData.templates[ templatePath ];

			var transformedHTML = mw.util.tmpl( rawHTML );

			var parentWindowDocument = $( window['parent'].document );
			var question = parentWindowDocument.find('.qnaQuestionTextArea').val();

			transformedHTML = transformedHTML({qnaEntryArray:this.getQnaData(), questionBoxText:question});
			return transformedHTML;
		},

		// Get the Q&A data from the server.
		getQnaData : function(){
			var qnaEntryArray = [];
			qnaEntryArray[qnaEntryArray.length] = {
				threadId: "s9oa3cc",
				type: "announcement",
				title: gM('qna-announcement-title'),
				text:"All your bases are belong to us"
			};
			// The below (commented out) is supposed to simulate a Q&A thread
			//qnaEntryArray[qnaEntryArray.length] = {
			//	threadId: "qyv78s1",
			//	type: "qna_thread",
			//	title: gM('qna-you-asked'),
			//	text: "gadol",
			//	qnalist: [
			//		{id: "d873j9", title:"aaa", text:"fdgfdgdfgsd sdf sf d"},
			//		{id: "i8a3xw", title:"aaa", text:"fdgfdgdfgsd sdf sf d"},
			//	]
			//};
			qnaEntryArray[qnaEntryArray.length] = {
				threadId: "qyv78a7",
				type: "announcement",
				title: gM('qna-announcement-title'),
				text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum a eros eu quam dictum sagittis. Nam sit amet odio turpis. Morbi mauris nisi, consequat et tortor a, vehicula pharetra sem. Nunc vitae lacus id sapien tristique pretium at non lorem. Integer venenatis lacus nec erat."
			};
			qnaEntryArray[qnaEntryArray.length] = {
				threadId: "",
				type: "announcement",
				title: gM('qna-announcement-title'),
				text:"This is a sample text for an announcement"
			};
			qnaEntryArray[qnaEntryArray.length] = {
				threadId: "",
				type: "announcement",
				title: gM('qna-announcement-title'),
				text:"just one more announcement..."
			};

			return qnaEntryArray;
		}
	}));

})(window.mw, window.jQuery);
