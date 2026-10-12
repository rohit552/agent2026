import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/api_client.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _auth = AuthService();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _register = false;
  bool _busy = false;
  bool _hidePassword = true;
  String _role = 'STUDENT';
  String _message = '';
  bool _messageIsError = false;

  @override
  void dispose() {
    _name.dispose(); _email.dispose(); _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _busy = true; _message = ''; });
    try {
      if (_register) {
        await _auth.register(fullName: _name.text, email: _email.text, password: _password.text, role: _role);
        setState(() {
          _register = false;
          _messageIsError = false;
          _message = 'Your account request was received. Account access stays pending until verification/approval is configured. You can sign in after your account is activated.';
          _password.clear();
        });
      } else {
        final user = await _auth.login(_email.text, _password.text);
        if (!mounted) return;
        Navigator.of(context).pop(user);
      }
    } catch (error) {
      setState(() { _messageIsError = true; _message = error is ApiException ? error.message : 'Could not reach SkillHeed. Check your connection and try again.'; });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isBlue = const Color(0xFF1769FF);
    return Scaffold(
      appBar: AppBar(title: const Text('Your SkillHeed account'), backgroundColor: const Color(0xFFF7FAFF)),
      body: SafeArea(child: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(22), child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: Card(child: Padding(padding: const EdgeInsets.all(23), child: Form(key: _formKey, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(width: 48,height:48,alignment:Alignment.center,decoration:BoxDecoration(color:isBlue,borderRadius:BorderRadius.circular(15)),child:const Text('S',style:TextStyle(color:Colors.white,fontSize:27,fontWeight:FontWeight.w800))),
          const SizedBox(height:18),
          Text(_register?'Create your account':'Welcome back',style:Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight:FontWeight.w800,color:const Color(0xFF101D3A))),
          const SizedBox(height:7),
          Text(_register?'Start your learning and growth journey.':'Sign in to access your SkillHeed profile.',style:const TextStyle(fontSize:12,height:1.6,color:Color(0xFF687891))),
          const SizedBox(height:22),
          if (_register) ...[
            const Text('Full name',style:TextStyle(fontWeight:FontWeight.w700,fontSize:11)),
            const SizedBox(height:7),
            TextFormField(controller:_name,decoration:const InputDecoration(border:OutlineInputBorder(),hintText:'Enter your full name'),textCapitalization:TextCapitalization.words,validator:(v)=>(v==null||v.trim().length<2)?'Enter at least 2 characters':null),
            const SizedBox(height:15),
            const Text('Profile type',style:TextStyle(fontWeight:FontWeight.w700,fontSize:11)),
            const SizedBox(height:7),
            DropdownButtonFormField<String>(initialValue:_role,decoration:const InputDecoration(border:OutlineInputBorder()),items:const [
              DropdownMenuItem(value:'STUDENT',child:Text('Student / learner')),
              DropdownMenuItem(value:'PARENT',child:Text('Parent / guardian')),
              DropdownMenuItem(value:'TEACHER',child:Text('Teacher / educator')),
              DropdownMenuItem(value:'MENTOR',child:Text('Mentor / counsellor')),
              DropdownMenuItem(value:'RECRUITER',child:Text('Recruiter / employer')),
              DropdownMenuItem(value:'PARTNER',child:Text('Partner')),
            ],onChanged:(value){if(value!=null)setState(()=>_role=value);}),
            const SizedBox(height:15),
          ],
          const Text('Email address',style:TextStyle(fontWeight:FontWeight.w700,fontSize:11)),
          const SizedBox(height:7),
          TextFormField(controller:_email,keyboardType:TextInputType.emailAddress,autocorrect:false,decoration:const InputDecoration(border:OutlineInputBorder(),hintText:'name@example.com'),validator:(v){if(v==null||!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v.trim()))return'Enter a valid email address';return null;}),
          const SizedBox(height:15),
          const Text('Password',style:TextStyle(fontWeight:FontWeight.w700,fontSize:11)),
          const SizedBox(height:7),
          TextFormField(controller:_password,obscureText:_hidePassword,decoration:InputDecoration(border:const OutlineInputBorder(),hintText:_register?'At least 12 characters':'Enter your password',suffixIcon:IconButton(onPressed:()=>setState(()=>_hidePassword=!_hidePassword),icon:Icon(_hidePassword?Icons.visibility_outlined:Icons.visibility_off_outlined))),validator:(v){if(v==null||v.isEmpty)return'Enter your password';if(_register&&v.length<12)return'Use at least 12 characters';if(v.length>128)return'Password is too long';return null;}),
          const SizedBox(height:18),
          if(_message.isNotEmpty) Container(padding:const EdgeInsets.all(12),decoration:BoxDecoration(color:_messageIsError?const Color(0xFFFFEEEE):const Color(0xFFE7F9EF),borderRadius:BorderRadius.circular(10)),child:Text(_message,style:TextStyle(fontSize:11,height:1.6,color:_messageIsError?const Color(0xFFB42323):const Color(0xFF087847)))),
          if(_message.isNotEmpty) const SizedBox(height:13),
          FilledButton(onPressed:_busy?null:_submit,style:FilledButton.styleFrom(padding:const EdgeInsets.symmetric(vertical:15)),child:_busy?const SizedBox(height:18,width:18,child:CircularProgressIndicator(strokeWidth:2)):Text(_register?'Create account':'Sign in')),
          TextButton(onPressed:_busy?null:() => setState(() { _register = !_register; _message = ''; }),child:Text(_register?'Already have an account? Sign in':'New to SkillHeed? Create an account')),
          const SizedBox(height:3),
          const Text('Your data is transmitted to the configured SkillHeed API. Do not use production accounts until verification, recovery and privacy workflows are enabled.',textAlign:TextAlign.center,style:TextStyle(fontSize:9,height:1.6,color:Color(0xFF8A96A8))),
        ])))),
      )))),
    );
  }
}
