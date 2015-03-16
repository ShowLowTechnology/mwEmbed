<?php
/**
 * Quiz plugin manifest
*/

return array (
	'quiz' => array(
		'description' => 'Quiz description.',
		'attributes' => array(
			'parent' => array(
				'doc' => 'Parent container for component. Components include default placement, leave as null if unsure.',
				'type' => 'enum',
				'enum' => array("topBarContainer", "videoHolder", "controlsContainer")
			),
		)
	)
);
