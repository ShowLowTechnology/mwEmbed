(function (mw, $) {
	"use strict";

	mw.PluginManager.add('quiz', mw.KBaseScreen.extend({

		defaultConfig: {
			parent: "controlsContainer",
			order: 5,
			align: "right",
			tooltip:  gM( 'mwe-quiz-tooltip' ),
			visible: false,
			showTooltip: true,
			displayImportance: 'medium',
			templatePath: '../Quiz/resources/quiz.tmpl.html',

			usePreviewPlayer: false,
			previewPlayerEnabled: false

		},

		iconBtnClass: "icon-share",
		entryData: null,

		setup: function () {

			this.addBindings();

		},

		addBindings: function () {
			var _this = this;
			var embedPlayer = this.getPlayer();
			this.bind('layoutBuildDone', function () {

				var entryRequest = {
					'service': 'baseEntry',
					'action': 'get',
					'entryId': "0_l1v5vzh3"
				};
				_this.getKClient().doRequest(entryRequest, function (entryDataResult) {
					_this.entryData = entryDataResult;
					_this.showScreen();
				});

			});
		},

		getKClient: function () {
			if (!this.kClient) {
				this.kClient = mw.kApiGetPartnerClient(this.embedPlayer.kwidgetid);
			}
			return this.kClient;
		},

		getTemplateData: function () {
			return {
				'quiz': this
			};
		}


	}));

})(window.mw, window.jQuery);
