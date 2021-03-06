'use strict';

/* Controllers */
var dashboardApp = angular.module('app');

var Panel = {CLOUDY: 50, RAINY: 100};


dashboardApp.controller('MainDashboardCtrl', ['$scope', '$resource', '$timeout', 'mySocket',
  function ($scope, $resource, $timeout, mySocket) {


    var ResourceDailySummary = $resource('/api/errors/summary/dailySummaryForDashboard', {}, {cache: false});

    ResourceDailySummary.query({fromDateStamp: new Date().setHours(0, 0, 0, 0)})
      .$promise.then(function (errorDailySummary) {
        console.log(errorDailySummary);
        $scope.projects = errorDailySummary;
      });

    //temporary test data
    /*    $scope.projects = [
     {key: 'YosiJoA', total: '50', topBrowser: 'Chrome1.1.12'},
     {key: 'HaksYoMan', total: '150', topBrowser: 'Chrome1.9.12'},
     {key: 'MyPantom', total: '13113', topBrowser: 'IE1.1.12'}];*/

    //Y axis max
    var maxY = 10;

    //realtime graph data
    $scope.options = {
      chart: {
        type: 'stackedAreaChart',
        height: 180,
        margin: {
          top: 20,
          right: 20,
          bottom: 40,
          left: 55
        },
        x: function (d) {
          return d.x;
        },
        y: function (d) {
          return d.y;
        },
        useInteractiveGuideline: true,
        showControls: false,
        clipEdge: true,
        transitionDuration: 1,
        yDomain: [0, maxY],
        yAxis: {
          tickFormat: function (d) {
            return d3.format('d')(d);
          }
        },
        xAxis: {
          tickFormat: function (d) {
            return d3.time.format('%H:%M:%S')(new Date(d));
          }
        }
      }
    };

    //$scope.data = [{values: [], key: 'n/a'}];
    $scope.data = [];
    $scope.saved = [];
    $scope.interval = 0;

    //dummy graph
    //var interval = 5;
    //var max = 10 * 60 / interval;
    //for (var i = 0; i < max; i++) {
    //  $scope.data[0].values.push({x: Date.now() - (max - i) * interval * 1000, y: 0});
    //}
    //$scope.run = true;


    //connect to socket
    mySocket.forward('allErrorCount', $scope);
    mySocket.forward('interval', $scope);

    $scope.$on('socket:interval', function(ev, data) {
      $scope.interval = data.interval;
      $scope.maxX = 10 * 60 / data.interval; //10 minute
    });

    $scope.totalVisible = true;
    $scope.$on('socket:allErrorCount', function (ev, data) {
      //console.log(data);

      //##############################
      //put data to panel
      //##############################
      //$scope.projects = [{key: 'YosiJoA', total: '50', topBrowser: 'Chrome1.1.12'}];
      var projectIndex = getIndexByPjtId($scope.projects, data.project);
      if (projectIndex >= 0 && data.y > 0) {
        $scope.totalVisible = false;

        $timeout(function () {
          $scope.projects[projectIndex].total += data.y;
          $scope.$broadcast('changeErrorCount');
          $scope.totalVisible = true;
        }, 1000);
      }

      //##############################
      //put data to graph & shift
      //##############################
      var dataIndex = getIndexByPjtId($scope.data, data.project);
      if (dataIndex < 0) {
        $scope.data.push({values: [], key: data.project});
        dataIndex = $scope.data.length - 1;
      }

      $scope.data[dataIndex].values.push({x: data.x, y: data.y});
      if ($scope.data[dataIndex].values.length > $scope.maxX) $scope.data[dataIndex].values.shift();

      //resize y axis scale
      var sumY = 0;
      var tempLen = $scope.data[dataIndex].values.length;
      console.log('tempLen=%d', tempLen);
      for (var i = 0; i < $scope.data.length; i++) {
        sumY += $scope.data[i].values[tempLen - 1].y;
      }
      console.log('sumY=' + sumY);
      if (sumY > maxY) {
        maxY = sumY;
        $scope.options.chart.yDomain = [0, maxY];
      }

      //TODO - pending & matching all series (currently script error on nvd3. but working)
      /*        console.log('$scope.data.length=%d', $scope.data.length);
       console.log('$scope.saved.length=%d', $scope.saved.length);
       if($scope.data.length > $scope.saved.length + 1) {
       console.log('saved==>%d, %d, %d', data.x, data.y, dataIndex);
       $scope.saved.push({x: data.x, y: data.y, index: dataIndex})
       } else {
       for(var i=0; i<$scope.saved.length; i++) {
       var savedIndex = $scope.saved[i].index;
       var savedX = $scope.saved[i].x;
       var savedY = $scope.saved[i].y;
       console.log('load==>%d, %d, %d', savedX, savedY, savedIndex);
       $scope.data[savedIndex].values.push({x: savedX, y: savedY});
       if ($scope.data[savedIndex].values.length > max) $scope.data[savedIndex].values.shift();
       }
       console.log('direct==>%d, %d, %d', data.x, data.y, dataIndex);
       $scope.prevData = [];
       $scope.data[dataIndex].values.push({x: data.x, y: data.y});
       if ($scope.data[dataIndex].values.length > max) $scope.data[dataIndex].values.shift();
       }*/
      //$scope.$apply();
    });

    //mySocket.emit('signin');
  }]);

dashboardApp.controller('PanelController', ['$scope',
  function ($scope) {
    $scope.$on('changeErrorCount', function () {
      setPanelClass();
    });
    setPanelClass();

    function setPanelClass() {
      $scope.panelClass = 'panel-red';
      if ($scope.project.total > Panel.RAINY) {
        $scope.panelClass = 'panel-red';
        $scope.faIcon = 'fa-umbrella';
      } else if ($scope.project.total > Panel.CLOUDY) {
        $scope.panelClass = 'panel-yellow';
        $scope.faIcon = 'fa-cloud';
      } else {
        $scope.panelClass = 'panel-green';
        $scope.faIcon = 'fa-certificate';
      }
    }
  }]);

dashboardApp.directive('ngxFadeToggle', function () {
  return {
    link: function (scope, element, attrs) {
      scope.$watch(attrs.ngxFadeToggle, function (val, oldVal) {
        if (val === oldVal) return;
        element[val ? 'fadeIn' : 'fadeOut'](1000);
      });
    }
  }
});

var getIndexByPjtId = (function (scopeData, pjtId) {
  for (var i = 0; i < scopeData.length; i++) {
    if (scopeData[i].key === pjtId) {
      return i;
    }
  }
  return -1;
});