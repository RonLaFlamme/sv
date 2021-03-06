'use strict';

angular.module('sv')
  .controller('MainCtrl', function ($scope, $timeout, GithubAPI) {
	
    $scope.user = {'username': '', 'repos':[], 'branches':[], 'currentRepo':'', 'currentBranch': '', 'currentCommits':[]}
    $scope.currentPage = 0;
    $scope.pageSize = 10;
	$scope.numberOfPages=function(){
		if($scope.user.initialCommits &&
			$scope.user.initialCommits.length > 0){
			return Math.ceil($scope.user.initialCommits.length/$scope.pageSize);
		}
		else{
			return 1;
		}
    }
	
	//var dbClient = new Dropbox.Client({ key: 'ul8h8jpx9o164n1'});
	if(!$scope.dbClient){
		$scope.dbClient = new Dropbox.Client({ key: '4nl4o8v9y9wqv1i' });
	}
	
	if($scope.dbClient.isAuthenticated()){
		angular.element("#loginDropbox").text("Dropbox Account Linked!");	
	}
	
	$scope.usernameChange = function(){		
		$scope.user.branches = [];
		$scope.user.repos = [];
		$scope.user.currentRepo = '';
		$scope.user.currentBranch = '';
		$scope.user.currentCommits = [];
		
        GithubAPI.getRepos($scope.user.username).then(function(data){
			if(data.error){
				alert(data.error);
			}
			else{
				$scope.user.repos = [];
				angular.forEach(data, function(repo){
					$scope.user.repos.push(repo.full_name.split("/").pop());
				});
			}
        });
		return false;
    }
    
    $scope.repoChanged = function(){
        $scope.user.branches = [];
		$scope.user.currentBranch = '';
		$scope.user.currentCommits = [];
		
        GithubAPI.getBranches($scope.user.username, $scope.user.currentRepo).then(function(data){
            angular.forEach(data, function(branch){
                $scope.user.branches.push(branch.name);
            });
			$scope.user.currentBranch = 'master';
        });
    }
	
	$scope.$watch("user.currentBranch", function(newVal){
		if (newVal){
			branchChanged();
		}
	});

    var branchChanged = function(){
		$scope.user.currentCommits = [];
		$scope.user.initialCommits = [];
		
        GithubAPI.getCommits($scope.user.username, $scope.user.currentRepo, $scope.user.currentBranch).then(function(data){
            			
			// set log filename to most recent commit date
			if(data && data.length > 0){  
				$scope.dbFilename=$scope.user.currentRepo+ "_" + data[0].commit.committer.date + ".log";
			}
			
			if($scope.dbClient.isAuthenticated()){				
				for(var i = 0; i < data.length; i++){
					var commit = data[i];
					var commitDate = commit.commit.committer.date;
					var previousCommitDate = i + 1 < data.length ? 
										data[i+1].commit.committer.date : null;
					
					$scope.user.initialCommits.push({
							'timestamp': commitDate, 
							'hostId':  "Updating...",
							'commit':  commit.sha,
							'previousCommitDate': previousCommitDate});
					
				}
				
				angular.forEach($scope.user.initialCommits, function(currentCommit){
					GithubAPI.getCommit($scope.user.username, $scope.user.currentRepo,
										currentCommit.commit).then(function(commitInfo){											
											
					if(commitInfo.hasOwnProperty("files") &&
						commitInfo.files.length > 0){	
						
						// grab first file in commit and retrieve DB host_id
						var filename = $scope.user.currentRepo + '/' + commitInfo.files[0].filename;
						
						$scope.dbClient.history(filename, function(error, revisions){
							if(error){  
								currentCommit.hostId = error.responseText;
							}
							else if(revisions && revisions.length > 0){		
								currentCommit.hostId = "Not found";				
								for(var j = 0; j < revisions.length; j++){
									var revisionDate = revisions[j].modifiedAt;
									if(revisionDate <= new Date(currentCommit.timestamp) &&
										revisionDate >= new Date(currentCommit.previousCommitDate)){
										currentCommit.hostId = revisions[j]["host_id"];										
										break;
									}										
								}								
							}
							else{
								currentCommit.hostId = "Not available";
							}
							$timeout(function(){
							$scope.user.currentCommits.push({
								'timestamp': currentCommit.timestamp, 
								'hostId':  currentCommit.hostId,
								'commit':  currentCommit.commit,
							});		});					
						});
					}
					});
					
				});
			}	
			else{
				alert("Please first link to Dropbox");
			}
			
		});
    }
	
	$scope.loginClicked = function(){
		if(!$scope.dbClient.isAuthenticated()){
			$scope.dbClient.authDriver(new Dropbox.AuthDriver.Popup({ receiverUrl:  'https://ronlaflamme.github.io/sv/oauth_receiver.html' }));
			$scope.dbClient.authenticate(function(authError){
			if(authError || !$scope.dbClient.isAuthenticated()){
				alert("Cannot login to Dropbox!");
			}});
		}
		
		if($scope.dbClient.isAuthenticated()){
			angular.element("#loginDropbox").text("Dropbox Account Linked!");
		}		
	};
	
	$scope.saveToDropboxClick = function(){
		
		if($scope.user.currentBranch){			
				
			if(!$scope.dbClient.isAuthenticated()){
				$scope.dbClient.authDriver(new Dropbox.AuthDriver.Popup({ receiverUrl:  'https://ronlaflamme.github.io/sv/oauth_receiver.html' }));
				$scope.dbClient.authenticate(function(authError){
				if(authError || !$scope.dbClient.isAuthenticated()){
					alert("Cannot login to Dropbox!");
				}});
			}
			
			if($scope.dbClient.isAuthenticated()){
				var filename = $scope.dbFilename ? $scope.dbFilename : Date() + ".log";
				var foldername = $scope.user.currentRepo + "_log/";
				filename = filename.replace(/:/g, "_").replace(/Z/g, "");
				$scope.dbClient.writeFile(foldername + filename, 
					JSON.stringify($scope.user.currentCommits), 
					function(error, stat) {
					if (error) {
						alert(error);
					}
					else{ 
						alert("File saved to " + foldername.replace("/", "") + " in Dropbox.");
					}
				});
			}
		}
		else{
			alert("Please select a branch to save.");
		}
	};
  });
