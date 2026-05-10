from genlayer import *

class SmartVault(gl.Contract):
    def __init__(self):
        """
        Initializes the Smart Vault contract.
        Since the primary locking/routing logic is currently handled 
        off-chain in the PayStables app, this contract acts purely as 
        the decentralized Oracle/Evaluator on the Arc Network.
        """
        pass

    @gl.public.write
    def evaluate_condition(self, url: str, condition_prompt: str) -> str:
        """
        Evaluates a web condition using GenLayer's AI Consensus.
        This function requires multiple Validator Nodes to scrape the URL,
        evaluate the prompt, and reach a strict consensus before returning the result.
        """
        def llm_task() -> str:
            try:
                # 1. Fetch raw web data using GenLayer's web render capability
                raw_data = gl.nondet.web.render(url, mode="text")
                
                # 2. Construct the prompt for the LLM
                prompt = f'''
                You are a Smart Vault AI Oracle.
                Check this condition: "{condition_prompt}"
                
                Based on this webpage data:
                ---
                {raw_data[:5000]} 
                ---
                
                Return exactly "TRUE" if the condition is met, or "FALSE" if it is not met. Do not include any other text.
                '''
                
                # 3. Execute the prompt via the node's local LLM
                result = gl.nondet.exec_prompt(prompt).strip().upper()
                
                if "TRUE" in result:
                    return "TRUE"
                return "FALSE"
                
            except Exception as e:
                # If the webpage fails to load, return UNDETERMINED
                # so a transient network blip doesn't penalize the recipient
                return "UNDETERMINED"
            
        # 4. Use Strict Equality Consensus
        # GenLayer requires a threshold of validators to return the EXACT same string
        # before this function writes to state or returns.
        consensus_result = gl.eq_principle.strict_eq(llm_task)
        
        return consensus_result
