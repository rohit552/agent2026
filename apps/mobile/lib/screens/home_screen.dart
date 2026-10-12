import 'package:flutter/material.dart';
import '../services/api_client.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _api = ApiClient();
  String _apiState = 'Checking API connection…';

  @override
  void initState() { super.initState(); _checkApi(); }

  Future<void> _checkApi() async {
    try {
      final result = await _api.getHealth();
      if (!mounted) return;
      setState(() => _apiState = result['status'] == 'ok' ? 'API connected' : 'API available with warnings');
    } catch (_) {
      if (!mounted) return;
      setState(() => _apiState = 'API not reachable — configure API URL');
    }
  }

  @override
  Widget build(BuildContext context) {
    final modules = [
      ('Smart Learning','Courses, lessons and learning paths',Icons.school_outlined,const Color(0xFFEAF3FF)),
      ('AI Assessments','Discover aptitude, interests and skills',Icons.psychology_alt_outlined,const Color(0xFFF1EDFF)),
      ('Mentorship','Guidance and career roadmaps',Icons.diversity_3_outlined,const Color(0xFFE7FBF0)),
      ('Jobs & Internships','Explore skills-based opportunities',Icons.work_outline,const Color(0xFFFFF0E8)),
      ('Olympiads & Quests','Join challenges and competitions',Icons.emoji_events_outlined,const Color(0xFFFFF5DF)),
      ('Sports & Talent','Showcase achievements and discover events',Icons.sports_soccer_outlined,const Color(0xFFE7FAFF)),
    ];
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFFF7FAFF),
        title: Row(children: [
          Container(width:36,height:36,alignment:Alignment.center,decoration:BoxDecoration(color:const Color(0xFF1769FF),borderRadius:BorderRadius.circular(12)),
            child: const Text('S',style:TextStyle(color:Colors.white,fontWeight:FontWeight.w800,fontSize:21))),
          const SizedBox(width:10), const Text('SkillHeed',style:TextStyle(fontWeight:FontWeight.w800,letterSpacing:-.5)),
        ]),
        actions: [IconButton(onPressed:_checkApi,icon:const Icon(Icons.sync_rounded),tooltip:'Check API')],
      ),
      body: SafeArea(child: ListView(padding:const EdgeInsets.fromLTRB(20,18,20,30),children:[
        Container(padding:const EdgeInsets.all(24),decoration:BoxDecoration(borderRadius:BorderRadius.circular(26),gradient:const LinearGradient(colors:[Color(0xFFEAF4FF),Color(0xFFD7E9FF)],begin:Alignment.topLeft,end:Alignment.bottomRight)),
          child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            const Text('YOUR GROWTH, CONNECTED',style:TextStyle(fontSize:10,letterSpacing:1,fontWeight:FontWeight.w800,color:Color(0xFF41628B))),
            const SizedBox(height:15),
            Text('One platform.\nInfinite possibilities.',style:Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight:FontWeight.w800,color:const Color(0xFF101D3A),height:1.12,letterSpacing:-1.2)),
            const SizedBox(height:12),
            const Text('Learning, skills, mentorship and career opportunities — all connected in one ecosystem.',style:TextStyle(fontSize:12,height:1.7,color:Color(0xFF536A88))),
            const SizedBox(height:18),
            FilledButton(onPressed:()=>_showInfo(context,'Create account','Connect this action to the registration endpoint and a verified email/OTP provider.'),child:const Text('Get started')),
          ])),
        const SizedBox(height:22),
        Text('Explore SkillHeed',style:Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight:FontWeight.w800,color:const Color(0xFF101D3A))),
        const SizedBox(height:12),
        ...modules.map((m)=>Card(margin:const EdgeInsets.only(bottom:10),child:ListTile(contentPadding:const EdgeInsets.all(12),
          leading:Container(width:47,height:47,decoration:BoxDecoration(color:m.$4,borderRadius:BorderRadius.circular(14)),child:Icon(m.$3,color:const Color(0xFF1769FF))),
          title:Text(m.$1,style:const TextStyle(fontWeight:FontWeight.w800,fontSize:13)),
          subtitle:Padding(padding:const EdgeInsets.only(top:5),child:Text(m.$2,style:const TextStyle(fontSize:11,height:1.5))),
          trailing:const Icon(Icons.arrow_forward_ios_rounded,size:15),
          onTap:()=>_showInfo(context,m.$1,'This module UI and protected API endpoints need to be implemented before enabling live actions.'),
        ))),
        const SizedBox(height:8),
        Row(children:[Icon(_apiState=='API connected'?Icons.check_circle:Icons.info_outline,size:16,color:_apiState=='API connected'?Colors.green:Colors.blueGrey),const SizedBox(width:8),Expanded(child:Text(_apiState,style:const TextStyle(fontSize:10,color:Color(0xFF687891))))]),
      ])),
      bottomNavigationBar:NavigationBar(selectedIndex:0,destinations:const[
        NavigationDestination(icon:Icon(Icons.home_outlined),selectedIcon:Icon(Icons.home),label:'Home'),
        NavigationDestination(icon:Icon(Icons.explore_outlined),label:'Explore'),
        NavigationDestination(icon:Icon(Icons.bookmark_border),label:'Saved'),
        NavigationDestination(icon:Icon(Icons.person_outline),label:'Profile'),
      ],onDestinationSelected:(i){if(i!=0)_showInfo(context,['Home','Explore','Saved','Profile'][i],'This destination is a planned screen; implement its navigation and API workflow before release.');}),
    );
  }

  void _showInfo(BuildContext context,String title,String body) {
    showModalBottomSheet<void>(context:context,showDragHandle:true,builder:(context)=>Padding(padding:const EdgeInsets.fromLTRB(22,10,22,30),child:Column(mainAxisSize:MainAxisSize.min,crossAxisAlignment:CrossAxisAlignment.start,children:[
      Text(title,style:const TextStyle(fontSize:19,fontWeight:FontWeight.w800)),const SizedBox(height:9),Text(body,style:const TextStyle(fontSize:13,height:1.65,color:Color(0xFF687891)))
    ])));
  }
}
